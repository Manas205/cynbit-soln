import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.ts';
import { openDatabase } from '../server/database.ts';

test('inquiry API preserves intent, validates input, and handles retries safely', async t => {
  const db = openDatabase(':memory:');
  const server = createServer(createApi(db));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const inquiry = {
    answers: { goal: 'property', needs: ['rent', 'tenants'], stage: 'existing', timeline: 'quarter' },
    selectedSolution: 'tenantease', name: 'Demo Visitor', email: 'visitor@example.com', company: 'Test Properties', message: 'Test inquiry only.', consent: true,
  };
  const send = (data: unknown, key = randomUUID(), headers: Record<string, string> = {}) => fetch(`${url}/api/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...headers }, body: JSON.stringify(data) });
  try {
    await t.test('valid inquiry saves the selected product and returns a reference', async () => {
      const response = await send(inquiry);
      assert.equal(response.status, 201);
      const receipt = await response.json();
      assert.equal(receipt.solution, 'TenantEase');
      assert.match(receipt.reference, /^CB-\d{8}-[A-F0-9]{8}$/);
      assert.equal(receipt.prototype, true);
      const row = db.prepare('SELECT selected_solution, recommended_solution, answers_json FROM inquiries WHERE id = ?').get(receipt.reference);
      assert.equal(row?.selected_solution, 'tenantease');
      assert.equal(row?.recommended_solution, 'tenantease');
      assert.deepEqual(JSON.parse(row?.answers_json as string).needs, ['rent', 'tenants']);
    });
    await t.test('a retry returns the original receipt without creating a duplicate', async () => {
      const key = randomUUID();
      const first = await (await send(inquiry, key)).json();
      const retry = await send(inquiry, key);
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).reference, first.reference);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE request_key = ?').get(key)?.n, 1);
      assert.equal((await send({ ...inquiry, name: 'Different Visitor' }, key)).status, 409);
    });
    await t.test('tampering, missing consent, malformed email, and stale answers are rejected', async () => {
      for (const data of [
        { ...inquiry, selectedSolution: 'studio' },
        { ...inquiry, consent: false },
        { ...inquiry, email: 'not-an-email' },
        { ...inquiry, answers: { ...inquiry.answers, needs: ['reviews'] } },
      ]) {
        const response = await send(data);
        assert.equal(response.status, 400);
        assert.ok((await response.json()).issues.length > 0);
      }
    });
    await t.test('cross-origin and non-JSON writes are rejected', async () => {
      assert.equal((await send(inquiry, randomUUID(), { Origin: 'https://unrelated.example' })).status, 403);
      assert.equal((await send(inquiry, randomUUID(), { 'Content-Type': 'text/plain' })).status, 415);
    });
    await t.test('oversized and malformed requests are rejected', async () => {
      assert.equal((await send({ ...inquiry, message: 'x'.repeat(25_000) })).status, 413);
      const response = await fetch(`${url}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
      assert.equal(response.status, 400);
    });
    await t.test('inquiries cannot be listed through a public GET endpoint', async () => {
      assert.equal((await fetch(`${url}/api/inquiries`)).status, 405);
    });
    await t.test('recommendation endpoint handles valid and invalid answers', async () => {
      const sendAnswer = (data: unknown) => fetch(`${url}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      assert.equal((await (await sendAnswer(inquiry.answers)).json()).primary.id, 'tenantease');
      assert.equal((await sendAnswer({ ...inquiry.answers, needs: [] })).status, 400);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); }
});

test('SQLite records survive closing and reopening the database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cynbit-persistence-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase(path);
  try {
    db.prepare('INSERT INTO inquiries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('test-ref', 'test-key', 'hash', 'tenantease', 'tenantease', 'v1', 'Demo', 'demo@example.com', '', '', '{}', 'now', 'now');
    db.close(); db = openDatabase(path);
    assert.equal(db.prepare('SELECT selected_solution FROM inquiries WHERE id = ?').get('test-ref')?.selected_solution, 'tenantease');
  } finally { db.close(); await unlink(path); await rmdir(directory); }
});
