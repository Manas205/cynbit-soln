import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  inquiryFiltersSchema,
  inquiryStatuses,
  inquiryUpdateSchema,
  type InquiryDetail,
  type InquiryStatus,
  type InquirySummary,
} from '../shared/admin.ts';
import { type AdminCredentials, verifyPassword } from './adminAuth.ts';
import { body, HttpError, json } from './http.ts';
import { caseStudyMetrics } from './caseStudyApi.ts';

export interface AdminOptions {
  credentials?: AdminCredentials;
  secureCookies?: boolean;
  origin?: string;
  now?: () => number;
  sessionTtlMs?: number;
}
const COOKIE = 'cynbit_admin';
const PAGE_SIZE = 20;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const loginSchema = z
  .object({ email: z.email().max(254), password: z.string().min(1).max(256) })
  .strict();
const selection = `i.id, i.name, i.email, i.company, i.selected_solution AS selectedSolution,
  i.created_at AS createdAt, COALESCE(m.status, 'new') AS status,
  (i.project_brief_json IS NOT NULL) AS hasBrief`;
const joined = 'FROM inquiries i LEFT JOIN inquiry_management m ON m.inquiry_id = i.id';

export function createAdminApi(db: DatabaseSync, options: AdminOptions) {
  const now = options.now || Date.now;
  const ttl = options.sessionTtlMs || 8 * 60 * 60_000;
  const sessions = new Map<string, { csrfToken: string; expires: number }>();
  const attempts = new Map<string, { count: number; resets: number }>();
  const cookie = (token: string, maxAge: number) =>
    `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${options.secureCookies ? '; Secure' : ''}`;
  const detail = (id: string): InquiryDetail => {
    const row = db
      .prepare(
        `SELECT ${selection}, i.message, i.answers_json, i.project_brief_json,
      i.recommended_solution AS recommendedSolution, COALESCE(m.notes, '') AS notes,
      COALESCE(m.version, 0) AS version, m.updated_at AS updatedAt ${joined} WHERE i.id = ?`,
      )
      .get(id);
    if (!row) throw new HttpError(404, 'This inquiry could not be found.');
    const { answers_json, project_brief_json, ...fields } = row;
    return {
      ...fields,
      hasBrief: Boolean(row.hasBrief),
      answers: JSON.parse(answers_json as string),
      projectBrief: project_brief_json ? JSON.parse(project_brief_json as string) : null,
    } as InquiryDetail;
  };

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname;
    const time = now();
    for (const [key, session] of sessions) if (session.expires <= time) sessions.delete(key);
    for (const [key, attempt] of attempts) if (attempt.resets <= time) attempts.delete(key);
    const rawToken =
      req.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${COOKIE}=`))
        ?.slice(COOKIE.length + 1) || '';
    const sessionKey = digest(rawToken);
    const session = sessions.get(sessionKey);
    const expectedOrigin =
      options.origin || `${options.secureCookies ? 'https' : 'http'}://${req.headers.host}`;
    if ((req.method !== 'GET' || req.headers.origin) && req.headers.origin !== expectedOrigin)
      throw new HttpError(403, 'This request must come from the admin dashboard.');
    if (req.headers['sec-fetch-site'] === 'cross-site')
      throw new HttpError(403, 'This request must come from the admin dashboard.');

    if (path === '/api/admin/session' && req.method === 'GET')
      return json(res, 200, {
        configured: Boolean(options.credentials),
        authenticated: Boolean(session),
        ...(session
          ? {
              email: options.credentials!.email,
              csrfToken: session.csrfToken,
              expiresAt: new Date(session.expires).toISOString(),
            }
          : {}),
      });
    if (!options.credentials)
      throw new HttpError(
        503,
        'Admin access has not been configured. Ask the project owner to set up an admin account.',
      );
    if (path === '/api/admin/session' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'local';
      const attempt = attempts.get(ip) || { count: 0, resets: time + 15 * 60_000 };
      if (attempt.count >= 10 || (!attempts.has(ip) && attempts.size >= 1000)) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((attempt.resets - time) / 1000)));
        throw new HttpError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
      }
      attempt.count++;
      attempts.set(ip, attempt);
      const parsed = loginSchema.safeParse(await body(req, 4096));
      if (!parsed.success) throw new HttpError(400, 'Enter a valid email and password.');
      const matches = await verifyPassword(parsed.data.password, options.credentials.passwordHash);
      if (!matches || parsed.data.email.toLowerCase() !== options.credentials.email)
        throw new HttpError(401, 'The email or password is incorrect.');
      sessions.delete(sessionKey);
      if (sessions.size >= 25) sessions.delete(sessions.keys().next().value!);
      const token = randomBytes(32).toString('hex');
      const created = { csrfToken: randomBytes(32).toString('hex'), expires: now() + ttl };
      sessions.set(digest(token), created);
      res.setHeader('Set-Cookie', cookie(token, Math.floor(ttl / 1000)));
      return json(res, 200, {
        configured: true,
        authenticated: true,
        email: options.credentials.email,
        csrfToken: created.csrfToken,
        expiresAt: new Date(created.expires).toISOString(),
      });
    }
    if (!session) throw new HttpError(401, 'Your session has ended. Sign in again to continue.');
    if (path === '/api/admin/case-study-analytics' && req.method === 'GET')
      return json(res, 200, { items: caseStudyMetrics(db) });
    if (req.method !== 'GET' && req.headers['x-csrf-token'] !== session.csrfToken)
      throw new HttpError(403, 'Refresh the dashboard and try again.');
    if (path === '/api/admin/session' && req.method === 'DELETE') {
      sessions.delete(sessionKey);
      res.setHeader('Set-Cookie', cookie('', 0));
      return json(res, 200, { configured: true, authenticated: false });
    }
    if (path === '/api/admin/inquiries' && req.method === 'GET') {
      const parsed = inquiryFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
      const { q, status, solution, from, to, page } = parsed.data;
      const clauses: string[] = [];
      const params: SQLInputValue[] = [];
      if (q) {
        clauses.push(
          "instr(lower(i.name || ' ' || i.company || ' ' || i.email || ' ' || i.id), lower(?)) > 0",
        );
        params.push(q);
      }
      if (status) {
        clauses.push("COALESCE(m.status, 'new') = ?");
        params.push(status);
      }
      if (solution) {
        clauses.push('i.selected_solution = ?');
        params.push(solution);
      }
      if (from) {
        clauses.push('i.created_at >= ?');
        params.push(`${from}T00:00:00.000Z`);
      }
      if (to) {
        clauses.push('i.created_at <= ?');
        params.push(`${to}T23:59:59.999Z`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const total = db.prepare(`SELECT COUNT(*) AS n ${joined} ${where}`).get(...params)!
        .n as number;
      const actualPage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
      const items = db
        .prepare(
          `SELECT ${selection} ${joined} ${where} ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, PAGE_SIZE, (actualPage - 1) * PAGE_SIZE)
        .map((row) => ({ ...row, hasBrief: Boolean(row.hasBrief) })) as unknown as InquirySummary[];
      const counts = Object.fromEntries(inquiryStatuses.map((status) => [status, 0])) as Record<
        InquiryStatus,
        number
      >;
      for (const row of db
        .prepare(
          `SELECT COALESCE(m.status, 'new') AS status, COUNT(*) AS n ${joined} GROUP BY COALESCE(m.status, 'new')`,
        )
        .all())
        counts[row.status as InquiryStatus] = row.n as number;
      return json(res, 200, { items, total, page: actualPage, pageSize: PAGE_SIZE, counts });
    }
    const match = path.match(/^\/api\/admin\/inquiries\/([A-Za-z0-9-]{1,80})$/);
    if (match && req.method === 'GET') return json(res, 200, detail(match[1]));
    if (match && req.method === 'PATCH') {
      const parsed = inquiryUpdateSchema.safeParse(await body(req, 24_000));
      if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = detail(match[1]);
        if (current.version !== parsed.data.version)
          throw new HttpError(
            409,
            'This inquiry was updated elsewhere. Load the latest version before saving again.',
          );
        db.prepare(
          `INSERT INTO inquiry_management (inquiry_id, status, notes, version, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(inquiry_id) DO UPDATE SET status = excluded.status, notes = excluded.notes, version = excluded.version, updated_at = excluded.updated_at`,
        ).run(
          match[1],
          parsed.data.status,
          parsed.data.notes,
          current.version + 1,
          new Date(now()).toISOString(),
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return json(res, 200, detail(match[1]));
    }
    if (match || ['/api/admin/session', '/api/admin/inquiries'].includes(path)) {
      res.setHeader(
        'Allow',
        match ? 'GET, PATCH' : path.endsWith('/session') ? 'GET, POST, DELETE' : 'GET',
      );
      throw new HttpError(405, 'This method is not supported.');
    }
    throw new HttpError(404, 'Endpoint not found.');
  };
}
