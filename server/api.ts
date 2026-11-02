import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { answersSchema, inquirySchema, recommend } from '../shared/recommend.ts';
import { solutions } from '../shared/catalog.ts';
import { body, HttpError, json } from './http.ts';
import { createAdminApi, type AdminOptions } from './adminApi.ts';

export function createApi(db: DatabaseSync, adminOptions: AdminOptions = {}) {
  const admin = createAdminApi(db, adminOptions);
  const attempts = new Map<string, { count: number; resets: number }>();
  const lookup = db.prepare(
    'SELECT id, selected_solution, created_at, payload_hash FROM inquiries WHERE request_key = ?',
  );
  const insert = db.prepare(`INSERT INTO inquiries (
    id, request_key, payload_hash, selected_solution, recommended_solution, catalog_version,
    name, email, company, message, answers_json, consent_at, created_at, project_brief_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  return async function api(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    try {
      if (path.startsWith('/api/admin/')) return await admin(req, res);
      if (req.method === 'GET' && path === '/api/health')
        return json(res, 200, { status: 'ok', mode: 'assessment-prototype' });
      if (!['/api/recommend', '/api/inquiries'].includes(path))
        return json(res, 404, { error: 'Endpoint not found.' });
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Use POST for this endpoint.' });
      }
      if (req.headers.origin) {
        let originHost = '';
        try {
          originHost = new URL(req.headers.origin).host;
        } catch {
          /* rejected below */
        }
        if (originHost !== req.headers.host)
          return json(res, 403, { error: 'This request must come from the Solution Finder.' });
      }
      const input = await body(req);
      if (path === '/api/recommend') {
        const parsed = answersSchema.safeParse(input);
        if (!parsed.success)
          return json(res, 400, {
            error: 'Please review your answers.',
            issues: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          });
        return json(res, 200, recommend(parsed.data));
      }

      const parsed = inquirySchema.safeParse(input);
      if (!parsed.success)
        return json(res, 400, {
          error: 'Please check the highlighted fields.',
          issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/i.test(key))
        return json(res, 400, { error: 'A valid request identifier is required.' });
      const data = parsed.data;
      const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const existing = lookup.get(key) as
        | {
            id: string;
            selected_solution: keyof typeof solutions;
            created_at: string;
            payload_hash: string;
          }
        | undefined;
      if (existing) {
        if (existing.payload_hash !== hash)
          return json(res, 409, {
            error:
              'This request identifier was already used for different details. Please try again.',
          });
        return json(res, 200, {
          reference: existing.id,
          solution: solutions[existing.selected_solution].name,
          receivedAt: existing.created_at,
          prototype: true,
        });
      }
      const now = Date.now();
      for (const [ip, item] of attempts) if (item.resets < now) attempts.delete(ip);
      const ip = req.socket.remoteAddress || 'local';
      const bucket = attempts.get(ip) || { count: 0, resets: now + 15 * 60_000 };
      if (bucket.count >= 10) {
        res.setHeader('Retry-After', Math.ceil((bucket.resets - now) / 1000));
        return json(res, 429, {
          error: 'Several demo requests were sent recently. Please try again in 15 minutes.',
        });
      }
      bucket.count++;
      attempts.set(ip, bucket);
      const result = recommend(data.answers);
      const createdAt = new Date().toISOString();
      const reference = `CB-${createdAt.slice(0, 10).replaceAll('-', '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
      insert.run(
        reference,
        key,
        hash,
        data.selectedSolution,
        result.primary.id,
        result.version,
        data.name,
        data.email,
        data.company,
        data.message,
        JSON.stringify(data.answers),
        createdAt,
        createdAt,
        data.projectBrief ? JSON.stringify(data.projectBrief) : null,
      );
      return json(res, 201, {
        reference,
        solution: solutions[data.selectedSolution].name,
        receivedAt: createdAt,
        prototype: true,
      });
    } catch (error) {
      if (error instanceof HttpError) return json(res, error.status, { error: error.message });
      console.error('Inquiry API failure:', error instanceof Error ? error.name : 'Unknown error');
      return json(res, 500, {
        error: path.startsWith('/api/admin/')
          ? 'We couldn’t complete this request. Please try again.'
          : 'We couldn’t save this request. Your details are still here; please try again.',
      });
    }
  };
}
