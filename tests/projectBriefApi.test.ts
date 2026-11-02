import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.ts';
import { openDatabase } from '../server/database.ts';
import {
  softwareAnswers,
  automationAnswers,
  softwareBrief,
  automationBrief,
  demoContact,
} from './brief-fixtures.ts';

test('brief inquiries persist both service types, enforce intent, and handle retries', async (t) => {
  const db = openDatabase(':memory:');
  const server = createServer(createApi(db));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const send = (data: unknown, key = randomUUID()) =>
    fetch(`http://127.0.0.1:${port}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(data),
    });
  const inquiry = {
    ...demoContact,
    answers: softwareAnswers,
    selectedSolution: 'software',
    projectBrief: softwareBrief,
  };
  try {
    await t.test(
      'complete briefs are stored with their solution and original finder answers',
      async () => {
        for (const [brief, answers] of [
          [softwareBrief, softwareAnswers],
          [automationBrief, automationAnswers],
        ] as const) {
          const response = await send({
            ...demoContact,
            selectedSolution: brief.solution,
            answers,
            projectBrief: brief,
          });
          assert.equal(response.status, 201);
          const { reference } = await response.json();
          const row = db
            .prepare(
              'SELECT project_brief_json, selected_solution, answers_json FROM inquiries WHERE id = ?',
            )
            .get(reference)!;
          assert.deepEqual(JSON.parse(row.project_brief_json as string), brief);
          assert.deepEqual(JSON.parse(row.answers_json as string), answers);
          assert.equal(row.selected_solution, brief.solution);
        }
      },
    );
    await t.test('a repeated brief is idempotent, but editing it requires a new key', async () => {
      const key = randomUUID();
      const first = await (await send(inquiry, key)).json();
      const retry = await send(inquiry, key);
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).reference, first.reference);
      assert.equal(
        db.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE request_key = ?').get(key)?.n,
        1,
      );
      assert.equal(
        (await send({ ...inquiry, projectBrief: { ...softwareBrief, budget: 'US$5,000' } }, key))
          .status,
        409,
      );
    });
    await t.test(
      'mismatched, incomplete, oversized fields are rejected before storage',
      async () => {
        const count = db.prepare('SELECT COUNT(*) AS n FROM inquiries').get()!.n;
        for (const projectBrief of [
          automationBrief,
          { ...softwareBrief, mustHaves: '' },
          { ...softwareBrief, budget: 'x'.repeat(121) },
        ]) {
          const response = await send({ ...inquiry, projectBrief });
          assert.equal(response.status, 400);
          assert.ok(
            (await response.json()).issues.some((issue: { field: string }) =>
              issue.field.startsWith('projectBrief.'),
            ),
          );
        }
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiries').get()!.n, count);
      },
    );
    await t.test('Unicode text within field limits is accepted', async () => {
      const projectBrief = {
        ...automationBrief,
        problem: '需'.repeat(1200),
        audience: '需'.repeat(400),
        mustHaves: '需'.repeat(1200),
        niceToHaves: '需'.repeat(800),
        integrations: '需'.repeat(600),
        success: '需'.repeat(800),
        budget: '需'.repeat(120),
        currentProcess: '需'.repeat(1200),
        tools: '需'.repeat(600),
      };
      assert.equal(
        (
          await send({
            ...demoContact,
            selectedSolution: 'ai-automation',
            answers: automationAnswers,
            message: '需'.repeat(2000),
            projectBrief,
          })
        ).status,
        201,
      );
    });
    await t.test('quick inquiries still work without a project brief', async () => {
      const response = await send({
        ...demoContact,
        answers: softwareAnswers,
        selectedSolution: 'software',
      });
      assert.equal(response.status, 201);
      const { reference } = await response.json();
      assert.equal(
        db.prepare('SELECT project_brief_json FROM inquiries WHERE id = ?').get(reference)
          ?.project_brief_json,
        null,
      );
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});

test('legacy databases migrate without losing inquiries and reopen safely', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cynbit-brief-migration-'));
  const path = join(directory, 'test.sqlite');
  let db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TABLE inquiries (
      id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
      selected_solution TEXT NOT NULL, recommended_solution TEXT NOT NULL, catalog_version TEXT NOT NULL,
      name TEXT NOT NULL, email TEXT NOT NULL, company TEXT NOT NULL, message TEXT NOT NULL,
      answers_json TEXT NOT NULL, consent_at TEXT NOT NULL, created_at TEXT NOT NULL
    )`);
    db.prepare('INSERT INTO inquiries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'old-demo',
      'old-key',
      'old-hash',
      'software',
      'software',
      'v1',
      'Demo Visitor',
      'demo@example.com',
      '',
      '',
      JSON.stringify(softwareAnswers),
      'now',
      'now',
    );
    db.close();
    db = openDatabase(path);
    assert.equal(
      db.prepare('SELECT name FROM inquiries WHERE id = ?').get('old-demo')?.name,
      'Demo Visitor',
    );
    assert.equal(
      db.prepare('SELECT project_brief_json FROM inquiries WHERE id = ?').get('old-demo')
        ?.project_brief_json,
      null,
    );
    db.prepare('UPDATE inquiries SET project_brief_json = ? WHERE id = ?').run(
      JSON.stringify(softwareBrief),
      'old-demo',
    );
    db.close();
    db = openDatabase(path);
    assert.deepEqual(
      JSON.parse(
        db.prepare('SELECT project_brief_json FROM inquiries WHERE id = ?').get('old-demo')
          ?.project_brief_json as string,
      ),
      softwareBrief,
    );
    assert.equal(
      db
        .prepare('PRAGMA table_info(inquiries)')
        .all()
        .filter((column) => column.name === 'project_brief_json').length,
      1,
    );
  } finally {
    db.close();
    await unlink(path);
    await rmdir(directory);
  }
});
