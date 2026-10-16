import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { migrate, type Db } from "./db.ts";

export async function openDb(file: string): Promise<Db> {
  const sqlite = new DatabaseSync(file);
  const db: Db = {
    all: async (sql, ...p) => sqlite.prepare(sql).all(...(p as SQLInputValue[])),
    get: async (sql, ...p) => sqlite.prepare(sql).get(...(p as SQLInputValue[])),
    run: async (sql, ...p) => {
      const r = sqlite.prepare(sql).run(...(p as SQLInputValue[]));
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
  };
  await migrate(db);
  return db;
}
