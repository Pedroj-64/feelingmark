/** Acceso a datos mínimo y asíncrono: lo implementan node:sqlite (db-node.ts) y Cloudflare D1 (d1.ts). */
export type Row = Record<string, unknown>;
export interface Db {
  all(sql: string, ...params: unknown[]): Promise<Row[]>;
  get(sql: string, ...params: unknown[]): Promise<Row | undefined>;
  run(sql: string, ...params: unknown[]): Promise<{ changes: number; lastId: number }>;
}

// Una sentencia por entrada: D1 no admite varias en un mismo exec.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    taken_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    thumb_mime TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS photos_taken_at ON photos (taken_at)",
  "CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, month TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS days (date TEXT PRIMARY KEY, note TEXT NOT NULL)",
  // Álbumes propios: nombre, portada y fotos (una foto puede estar en varios). Las invitaciones son un enlace por álbum.
  "CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cover_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS collection_items (collection_id INTEGER NOT NULL, photo_id INTEGER NOT NULL, added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (collection_id, photo_id))",
  "CREATE INDEX IF NOT EXISTS collection_items_photo ON collection_items (photo_id)",
  "CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, collection_id INTEGER NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  "CREATE TABLE IF NOT EXISTS invite_views (invite_id TEXT NOT NULL, viewer TEXT NOT NULL, first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (invite_id, viewer))",
];
// Bases creadas antes de v0.1.1 no tienen thumb_mime; el ALTER falla sin daño si ya existe.
const UPGRADES = ["ALTER TABLE photos ADD COLUMN thumb_mime TEXT"];

export async function migrate(db: Db) {
  for (const sql of SCHEMA) await db.run(sql);
  for (const sql of UPGRADES) await db.run(sql).catch(() => undefined);
}
