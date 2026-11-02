import { test } from 'node:test';
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
import { caseStudyMetrics } from '../server/caseStudyApi.ts';
import { softwareAnswers, softwareBrief, demoContact } from './brief-fixtures.ts';

test('case-study events are validated, deduplicated, private, bounded, and survive reopening', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'cynbit-case-studies-'));
  const path = join(folder, 'events.sqlite');
  let db = openDatabase(path);
  const credentials = {
    email: 'case-admin@example.com',
    passwordHash: await hashPassword('test-only-case-password'),
  };
  const server = createServer(createApi(db, { credentials }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const event = {
    id: randomUUID(),
    caseStudyId: 'connected-service-portal',
    type: 'view',
    source: 'recommendation',
  };
  const send = (value: unknown, headers: Record<string, string> = {}) =>
    fetch(`${origin}/api/case-study-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
      body: JSON.stringify(value),
    });
  try {
    await t.test(
      'duplicate identifiers count once and cannot be reused for another event',
      async () => {
        assert.equal((await send(event)).status, 201);
        assert.equal((await send(event)).status, 200);
        assert.equal((await send({ ...event, type: 'brief_start' })).status, 409);
        for (const type of ['brief_start', 'inquiry_start'])
          assert.equal((await send({ ...event, id: randomUUID(), type })).status, 201);
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM case_study_events').get()?.n, 3);
      },
    );
    await t.test(
      'bad payloads, additional personal data, unknown studies and cross-origin writes fail',
      async () => {
        for (const value of [
          { ...event, id: 'bad' },
          { ...event, caseStudyId: 'unknown' },
          { ...event, type: 'purchase' },
          { ...event, source: 'email' },
          { ...event, email: 'private@example.com' },
        ])
          assert.equal((await send(value)).status, 400);
        assert.equal((await send(event, { Origin: 'https://unrelated.example' })).status, 403);
        assert.equal((await send(event, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
        assert.equal((await send(event, { 'Content-Type': 'text/plain' })).status, 415);
        assert.equal((await send({ ...event, text: 'x'.repeat(3000) })).status, 413);
        assert.equal((await fetch(`${origin}/api/case-study-events`)).status, 405);
      },
    );
    let cookie = '';
    await t.test(
      'only authenticated admins can read counts, including zero-activity examples',
      async () => {
        assert.equal((await fetch(`${origin}/api/admin/case-study-analytics`)).status, 401);
        const login = await fetch(`${origin}/api/admin/session`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: 'test-only-case-password' }),
        });
        assert.equal(login.status, 200);
        cookie = login.headers.get('set-cookie')!.split(';')[0];
        const response = await fetch(`${origin}/api/admin/case-study-analytics`, {
          headers: { Cookie: cookie },
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const data = await response.json();
        assert.equal(data.items.length, 4);
        assert.deepEqual(data.items[0], {
          caseStudyId: event.caseStudyId,
          views: 1,
          briefStarts: 1,
          inquiryStarts: 1,
        });
        assert.equal(data.items[1].views, 0);
      },
    );
    await t.test(
      'inquiry persistence and admin details keep the case-study source and original project brief',
      async () => {
        const answers = { ...softwareAnswers, sourceCaseStudyId: event.caseStudyId };
        const payload = {
          ...demoContact,
          answers,
          selectedSolution: 'software',
          projectBrief: softwareBrief,
        };
        const key = randomUUID();
        const submit = () =>
          fetch(`${origin}/api/inquiries`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json', 'Idempotency-Key': key },
            body: JSON.stringify(payload),
          });
        const response = await submit();
        assert.equal(response.status, 201);
        const { reference } = await response.json();
        assert.equal((await submit()).status, 200);
        const detail = await (
          await fetch(`${origin}/api/admin/inquiries/${reference}`, { headers: { Cookie: cookie } })
        ).json();
        assert.deepEqual(detail.answers, answers);
        assert.deepEqual(detail.projectBrief, softwareBrief);
        assert.equal(detail.selectedSolution, 'software');
      },
    );
    await t.test(
      'event rate limiting does not block the recommendation or inquiry APIs',
      async () => {
        let response: Response | undefined;
        for (let attempt = 0; attempt <= 120; attempt++) {
          response = await send({ ...event, id: randomUUID() });
          if (response.status !== 201) break;
        }
        assert.equal(response?.status, 429);
        assert.ok(Number(response?.headers.get('retry-after')) > 0);
        assert.equal(
          (
            await fetch(`${origin}/api/recommend`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(softwareAnswers),
            })
          ).status,
          200,
        );
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    try {
      db = openDatabase(path);
      assert.ok(caseStudyMetrics(db)[0].views > 0);
      assert.equal(caseStudyMetrics(db)[0].briefStarts, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiries').get()?.n, 1);
      db.close();
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
});
