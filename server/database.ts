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
  return db;
}
