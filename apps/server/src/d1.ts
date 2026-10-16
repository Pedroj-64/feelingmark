import type { Db } from "./db.ts";

/** Adaptador para Cloudflare D1 (tipado mínimo para no depender de @cloudflare/workers-types). */
interface D1 {
  prepare(sql: string): {
    bind(...p: unknown[]): {
      all(): Promise<{ results: Record<string, unknown>[] }>;
      run(): Promise<{ meta: { changes: number; last_row_id: number } }>;
    };
  };
}

export function d1Db(d1: D1): Db {
  return {
    all: async (sql, ...p) =>
      (
        await d1
          .prepare(sql)
          .bind(...p)
          .all()
      ).results,
    get: async (sql, ...p) =>
      (
        await d1
          .prepare(sql)
          .bind(...p)
          .all()
      ).results[0],
    run: async (sql, ...p) => {
      const { meta } = await d1
        .prepare(sql)
        .bind(...p)
        .run();
      return { changes: meta.changes, lastId: meta.last_row_id };
    },
  };
}
