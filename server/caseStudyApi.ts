import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { caseStudies, caseStudyEventSchema, type CaseStudyMetrics } from '../shared/caseStudies.ts';
import { HttpError, json } from './http.ts';

export function createCaseStudyTracker(db: DatabaseSync) {
  const buckets = new Map<string, { count: number; reset: number }>();
  const lookup = db.prepare(
    'SELECT case_study_id, event_type, source FROM case_study_events WHERE id = ?',
  );
  const insert = db.prepare(
    'INSERT INTO case_study_events (id, case_study_id, event_type, source, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  return (req: IncomingMessage, res: ServerResponse, input: unknown) => {
    const parsed = caseStudyEventSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(400, 'Invalid case-study event.');
    const event = parsed.data;
    const time = Date.now();
    for (const [key, bucket] of buckets) if (bucket.reset <= time) buckets.delete(key);
    const ip = req.socket.remoteAddress || 'local';
    const bucket = buckets.get(ip) || { count: 0, reset: time + 15 * 60_000 };
    if (bucket.count >= 120 || (!buckets.has(ip) && buckets.size >= 1000)) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.reset - time) / 1000)));
      throw new HttpError(429, 'Too many analytics events. Try again later.');
    }
    bucket.count++;
    buckets.set(ip, bucket);
    const existing = lookup.get(event.id);
    if (existing) {
      if (
        existing.case_study_id !== event.caseStudyId ||
        existing.event_type !== event.type ||
        existing.source !== event.source
      )
        throw new HttpError(409, 'This event identifier has already been used.');
      return json(res, 200, { recorded: true });
    }
    insert.run(event.id, event.caseStudyId, event.type, event.source, new Date().toISOString());
    return json(res, 201, { recorded: true });
  };
}

export function caseStudyMetrics(db: DatabaseSync): CaseStudyMetrics[] {
  const rows = db
    .prepare(
      `SELECT case_study_id AS caseStudyId,
    SUM(event_type = 'view') AS views,
    SUM(event_type = 'brief_start') AS briefStarts,
    SUM(event_type = 'inquiry_start') AS inquiryStarts
    FROM case_study_events GROUP BY case_study_id`,
    )
    .all() as CaseStudyMetrics[];
  return caseStudies.map(
    (study) =>
      rows.find((row) => row.caseStudyId === study.id) || {
        caseStudyId: study.id,
        views: 0,
        briefStarts: 0,
        inquiryStarts: 0,
      },
  );
}
