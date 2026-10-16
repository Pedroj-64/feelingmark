import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDb } from "../src/db-node.ts";

test("una base de v0.1.0 (sin thumb_mime) se migra sin perder datos", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "fm-mig-")), "old.sqlite");
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE photos (id INTEGER PRIMARY KEY, key TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, taken_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO photos (key, hash, mime, taken_at) VALUES ('k', 'h', 'image/png', '2024-01-01T00:00:00.000Z');`);
  old.close();
  const db = await openDb(file);
  const row = await db.get("SELECT key, thumb_mime FROM photos WHERE hash = 'h'");
  assert.equal(row?.key, "k");
  assert.equal(row?.thumb_mime, null);
  await openDb(file); // idempotente
});
