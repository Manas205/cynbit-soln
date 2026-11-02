import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database.ts';
import { createApi } from '../server/api.ts';
import { hashPassword } from '../server/adminAuth.ts';
import type { AdminOptions } from '../server/adminApi.ts';
import {
  softwareAnswers,
  softwareBrief,
  automationAnswers,
  automationBrief,
  demoContact,
} from './brief-fixtures.ts';

const password = 'Test-only-password-for-admin';
const credentials = { email: 'admin@example.com', passwordHash: await hashPassword(password) };
async function setup(t: TestContext, options: AdminOptions = {}, path = ':memory:') {
  const db = openDatabase(path);
  const server = createServer(createApi(db, { credentials, ...options }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });
  const call = (path: string, init: RequestInit = {}) => fetch(`${origin}${path}`, init);
  async function login(headers: Record<string, string> = {}) {
    const response = await call('/api/admin/session', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ email: credentials.email, password }),
    });
    assert.equal(response.status, 200);
    const session = await response.json();
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    return { cookie, csrfToken: session.csrfToken as string, response, session };
  }
  async function submit(
    brief: typeof softwareBrief | typeof automationBrief | null = softwareBrief,
  ) {
    const response = await call('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({
        ...demoContact,
        selectedSolution: brief?.solution || 'software',
        answers: brief?.solution === 'ai-automation' ? automationAnswers : softwareAnswers,
        ...(brief ? { projectBrief: brief } : {}),
      }),
    });
    assert.equal(response.status, 201);
    return (await response.json()).reference as string;
  }
  return { db, call, origin, login, submit };
}

test('admin access fails closed and never exposes inquiries without a valid session', async (t) => {
  const { call, submit, login } = await setup(t);
  const id = await submit();
  assert.deepEqual(await (await call('/api/admin/session')).json(), {
    configured: true,
    authenticated: false,
  });
  for (const path of ['/api/admin/inquiries', `/api/admin/inquiries/${id}`]) {
    const response = await call(path);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!(await response.text()).includes(demoContact.email));
    assert.equal((await call(path, { headers: { Cookie: 'cynbit_admin=forged' } })).status, 401);
  }
  const auth = await login();
  assert.match(auth.response.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict/);
  assert.match(auth.response.headers.get('set-cookie')!, /Path=\/api\/admin/);
  assert.equal(
    (await call('/api/admin/session', { headers: { Cookie: auth.cookie } })).status,
    200,
  );
  assert.equal((await call('/api/inquiries')).status, 405);
});

test('unconfigured admin access stays unavailable while public inquiries work', async (t) => {
  const { call, origin, submit } = await setup(t, { credentials: undefined });
  await submit(null);
  assert.deepEqual(await (await call('/api/admin/session')).json(), {
    configured: false,
    authenticated: false,
  });
  assert.equal((await call('/api/admin/inquiries')).status, 503);
  assert.equal(
    (
      await call('/api/admin/session', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    503,
  );
});

test('login, session rotation, CSRF, logout and expiration protect admin writes', async (t) => {
  let time = Date.now();
  const { call, origin, login, submit } = await setup(t, { now: () => time, sessionTtlMs: 60_000 });
  const id = await submit();
  const loginBody = JSON.stringify({ email: credentials.email, password });
  const rejectedLoginHeaders: Record<string, string>[] = [
    {},
    { Origin: 'https://unrelated.example' },
    { Origin: origin, 'Sec-Fetch-Site': 'cross-site' },
  ];
  for (const headers of rejectedLoginHeaders) {
    assert.equal(
      (
        await call('/api/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: loginBody,
        })
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await call('/api/admin/session', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.email, password: 'wrong' }),
      })
    ).status,
    401,
  );
  const first = await login();
  const second = await login({ Cookie: first.cookie });
  assert.notEqual(first.cookie, second.cookie);
  assert.equal(
    (await call('/api/admin/inquiries', { headers: { Cookie: first.cookie } })).status,
    401,
  );
  const patch = JSON.stringify({ status: 'reviewing', notes: 'Contact next week.', version: 0 });
  const rejectedWriteHeaders: Record<string, string>[] = [
    { Cookie: second.cookie, Origin: origin },
    { Cookie: second.cookie, 'X-CSRF-Token': second.csrfToken },
    {
      Cookie: second.cookie,
      Origin: 'https://unrelated.example',
      'X-CSRF-Token': second.csrfToken,
    },
  ];
  for (const headers of rejectedWriteHeaders)
    assert.equal(
      (
        await call(`/api/admin/inquiries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: patch,
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await call('/api/admin/inquiries', {
        headers: { Cookie: second.cookie, Origin: 'https://unrelated.example' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call('/api/admin/session', {
        method: 'DELETE',
        headers: { Cookie: second.cookie, Origin: origin },
      })
    ).status,
    403,
  );
  const logout = await call('/api/admin/session', {
    method: 'DELETE',
    headers: { Cookie: second.cookie, Origin: origin, 'X-CSRF-Token': second.csrfToken },
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal(
    (await call('/api/admin/inquiries', { headers: { Cookie: second.cookie } })).status,
    401,
  );
  const third = await login();
  time += 60_001;
  assert.equal(
    (await call('/api/admin/inquiries', { headers: { Cookie: third.cookie } })).status,
    401,
  );
  assert.equal(
    (await (await call('/api/admin/session', { headers: { Cookie: third.cookie } })).json())
      .authenticated,
    false,
  );
});

test('login attempts are rate limited, including repeated successful logins', async (t) => {
  let time = Date.now();
  const { call, origin } = await setup(t, { now: () => time });
  const signin = (value: string) =>
    call('/api/admin/session', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: value }),
    });
  for (let i = 0; i < 10; i++) assert.equal((await signin('wrong')).status, 401);
  const limited = await signin(password);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  time += 15 * 60_000 + 1;
  assert.equal((await signin(password)).status, 200);
});

test('secure cookie and configured HTTPS origin support reverse-proxy hosting', async (t) => {
  const { call, login } = await setup(t, {
    origin: 'https://preview.example',
    secureCookies: true,
  });
  const auth = await login({ Origin: 'https://preview.example' });
  assert.match(auth.response.headers.get('set-cookie')!, /; Secure/);
  assert.equal(
    (await call('/api/admin/inquiries', { headers: { Cookie: auth.cookie } })).status,
    200,
  );
});

test('admin reads preserve both brief types and quick inquiries without leaking storage metadata', async (t) => {
  const { call, login, submit } = await setup(t);
  const auth = await login();
  for (const brief of [softwareBrief, automationBrief, null]) {
    const id = await submit(brief);
    const response = await call(`/api/admin/inquiries/${id}`, { headers: { Cookie: auth.cookie } });
    assert.equal(response.status, 200);
    const item = await response.json();
    assert.deepEqual(item.projectBrief, brief);
    assert.equal(item.status, 'new');
    assert.equal(item.notes, '');
    assert.equal(item.version, 0);
    assert.equal(item.hasBrief, Boolean(brief));
    assert.equal(item.email, demoContact.email);
    for (const field of ['request_key', 'payload_hash', 'passwordHash', 'answers_json'])
      assert.ok(!(field in item));
  }
  const list = await (
    await call('/api/admin/inquiries', { headers: { Cookie: auth.cookie } })
  ).json();
  assert.equal(list.total, 3);
  assert.equal(list.counts.new, 3);
  assert.ok(
    list.items.every(
      (item: Record<string, unknown>) => !('notes' in item) && !('projectBrief' in item),
    ),
  );
  assert.equal(
    (await call('/api/admin/inquiries/missing', { headers: { Cookie: auth.cookie } })).status,
    404,
  );
});

test('updates validate fields, prevent stale overwrites and preserve original inquiry content', async (t) => {
  const { call, db, origin, login, submit } = await setup(t);
  const id = await submit();
  const before = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);
  const auth = await login();
  const headers = {
    Cookie: auth.cookie,
    Origin: origin,
    'X-CSRF-Token': auth.csrfToken,
    'Content-Type': 'application/json',
  };
  const patch = (data: unknown) =>
    call(`/api/admin/inquiries/${id}`, { method: 'PATCH', headers, body: JSON.stringify(data) });
  for (const data of [
    { status: 'invalid', notes: '', version: 0 },
    { status: 'new', notes: 'x'.repeat(5001), version: 0 },
    { status: 'new', notes: '', version: -1 },
    { status: 'closed', notes: '', version: 0, email: 'changed@example.com' },
  ])
    assert.equal((await patch(data)).status, 400);
  assert.equal((await patch({ status: 'new', notes: 'x'.repeat(25_000), version: 0 })).status, 413);
  const notes = 'Ask about Zoho integration.\n<script>alert("plain text")</script>';
  const saved = await patch({ status: 'contacted', notes, version: 0 });
  assert.equal(saved.status, 200);
  const detail = await saved.json();
  assert.equal(detail.version, 1);
  assert.equal(detail.notes, notes);
  assert.ok(detail.updatedAt);
  assert.equal((await patch({ status: 'closed', notes: 'stale', version: 0 })).status, 409);
  assert.equal((await patch({ status: 'closed', notes: '', version: 1 })).status, 200);
  assert.deepEqual(db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id), before);
  const list = await (
    await call('/api/admin/inquiries?status=closed', { headers: { Cookie: auth.cookie } })
  ).json();
  assert.equal(list.total, 1);
  assert.equal(list.counts.closed, 1);
  assert.equal(list.counts.new, 0);
});

test('search, status, solution and UTC date filters combine with stable pagination', async (t) => {
  const { call, db, login } = await setup(t);
  const auth = await login();
  const insert = db.prepare(
    `INSERT INTO inquiries (id, request_key, payload_hash, selected_solution, recommended_solution, catalog_version, name, email, company, message, answers_json, consent_at, created_at, project_brief_json) VALUES (?, ?, 'hash', ?, ?, 'v1', ?, 'visitor@example.com', ?, '', ?, ?, ?, NULL)`,
  );
  for (let i = 0; i < 25; i++) {
    const solution = i % 2 ? 'ai-automation' : 'software';
    const date = `2026-11-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`;
    insert.run(
      `test-${String(i).padStart(2, '0')}`,
      randomUUID(),
      solution,
      solution,
      `Visitor ${i}`,
      i === 0 ? '100%_Demo' : 'Acme Demo',
      JSON.stringify(softwareAnswers),
      date,
      date,
    );
  }
  db.prepare(
    "INSERT INTO inquiry_management VALUES ('test-04', 'reviewing', 'Internal', 1, '2026-11-05T13:00:00.000Z')",
  ).run();
  const list = async (query = '') => {
    const response = await call(`/api/admin/inquiries${query}`, {
      headers: { Cookie: auth.cookie },
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await list();
  const second = await list('?page=2');
  assert.equal(first.items.length, 20);
  assert.equal(first.items[0].id, 'test-24');
  assert.equal(second.items.length, 5);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 25);
  assert.equal((await list('?page=900')).page, 2);
  const filtered = await list(
    '?solution=software&status=reviewing&q=ACME&from=2026-11-05&to=2026-11-05',
  );
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].id, 'test-04');
  assert.equal(filtered.counts.new, 24);
  assert.equal((await list('?q=100%25_')).total, 1);
  assert.equal((await list('?q=visitor%40example.com')).total, 25);
  assert.equal((await list('?q=%27%20OR%201%3D1--')).total, 0);
  assert.equal((await list('?q=does-not-exist')).total, 0);
  for (const query of [
    '?page=0',
    '?page=abc',
    '?status=lost',
    '?solution=unknown',
    '?from=2026-02-30',
    '?from=2026-11-20&to=2026-11-01',
    '?extra=1',
  ])
    assert.equal(
      (await call(`/api/admin/inquiries${query}`, { headers: { Cookie: auth.cookie } })).status,
      400,
    );
});

test('admin notes and statuses survive reopening an existing database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cynbit-admin-persistence-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase(path);
  try {
    db.prepare(
      `INSERT INTO inquiries (id, request_key, payload_hash, selected_solution, recommended_solution, catalog_version, name, email, company, message, answers_json, consent_at, created_at) VALUES ('legacy', 'key', 'hash', 'software', 'software', 'v1', 'Legacy demo', 'demo@example.com', '', '', ?, 'now', 'now')`,
    ).run(JSON.stringify(softwareAnswers));
    db.prepare(
      "INSERT INTO inquiry_management VALUES ('legacy', 'reviewing', 'Follow up tomorrow', 1, 'now')",
    ).run();
    db.close();
    db = openDatabase(path);
    assert.equal(
      db.prepare("SELECT status FROM inquiry_management WHERE inquiry_id = 'legacy'").get()?.status,
      'reviewing',
    );
    assert.equal(
      db.prepare("SELECT notes FROM inquiry_management WHERE inquiry_id = 'legacy'").get()?.notes,
      'Follow up tomorrow',
    );
    assert.equal(
      db.prepare("SELECT name FROM inquiries WHERE id = 'legacy'").get()?.name,
      'Legacy demo',
    );
  } finally {
    db.close();
    await rm(directory, { recursive: true });
  }
});
