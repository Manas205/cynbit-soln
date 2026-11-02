import { DatabaseSync } from 'node:sqlite';

export function openDatabase(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      request_key TEXT UNIQUE NOT NULL,
      payload_hash TEXT NOT NULL,
      selected_solution TEXT NOT NULL,
      recommended_solution TEXT NOT NULL,
      catalog_version TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      message TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  const columns = db.prepare('PRAGMA table_info(inquiries)').all();
  if (!columns.some((column) => column.name === 'project_brief_json'))
    db.exec('ALTER TABLE inquiries ADD COLUMN project_brief_json TEXT');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS inquiry_management (
      inquiry_id TEXT PRIMARY KEY REFERENCES inquiries(id),
      status TEXT NOT NULL CHECK (status IN ('new', 'reviewing', 'contacted', 'closed')),
      notes TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS inquiries_created_at ON inquiries(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS inquiries_solution ON inquiries(selected_solution);
    CREATE TABLE IF NOT EXISTS case_study_events (
      id TEXT PRIMARY KEY,
      case_study_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('view', 'brief_start', 'inquiry_start')),
      source TEXT NOT NULL CHECK (source IN ('gallery', 'recommendation')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS case_study_events_study ON case_study_events(case_study_id, event_type);
  `);
  return db;
}
