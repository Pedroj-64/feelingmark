import { DatabaseSync } from "node:sqlite";

export function openDb(file: string) {
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    taken_at TEXT NOT NULL,   -- ISO 8601
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS photos_taken_at ON photos (taken_at);`);
  return db;
}
export type Db = ReturnType<typeof openDb>;
