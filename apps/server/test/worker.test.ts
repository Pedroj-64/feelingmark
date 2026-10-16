import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { test } from "node:test";
import worker from "../src/worker.ts";

// D1 y R2 simulados con node:sqlite y un Map: comprueba el pegamento del Worker (migración, auth, rutas).
const sqlite = new DatabaseSync(":memory:");
const DB = {
  prepare: (sql: string) => ({
    bind: (...p: unknown[]) => ({
      all: async () => ({ results: sqlite.prepare(sql).all(...(p as SQLInputValue[])) as Record<string, unknown>[] }),
      run: async () => {
        const r = sqlite.prepare(sql).run(...(p as SQLInputValue[]));
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
      },
    }),
  }),
};
const objects = new Map<string, Uint8Array>();
const BUCKET = {
  put: async (k: string, v: Uint8Array) => void objects.set(k, v),
  get: async (k: string) => (objects.has(k) ? { arrayBuffer: async () => objects.get(k)!.slice().buffer as ArrayBuffer } : null),
};
const env = { DB, BUCKET, AUTH_TOKEN: "t" };
const auth = { authorization: "Bearer t" };

test("Worker: sin AUTH_TOKEN falla con un mensaje claro", async () => {
  const r = await worker.fetch(new Request("http://x/photos?month=2024-01"), { DB, BUCKET });
  assert.equal(r.status, 500);
});

test("Worker: auth, subida con miniatura del cliente, calendario y video no disponible", async () => {
  assert.equal((await worker.fetch(new Request("http://x/photos?month=2024-01"), env)).status, 401);
  const f = new FormData();
  f.set("file", new File([new Uint8Array([0xff, 0xd8, 9, 9, 0xff, 0xd9])], "a.jpg", { type: "image/jpeg" }));
  f.set("thumb", new File([new Uint8Array([1, 2, 3])], "t.jpg", { type: "image/jpeg" }));
  f.set("takenAt", "2024-01-05T10:00:00Z");
  const up = await worker.fetch(new Request("http://x/photos", { method: "POST", body: f, headers: auth }), env);
  assert.equal(up.status, 201);
  const month = await (await worker.fetch(new Request("http://x/photos?month=2024-01", { headers: auth }), env)).json();
  assert.deepEqual(month.days["2024-01-05"], [1]);
  assert.equal(month.video, false); // la app oculta el botón de video
  const thumb = await worker.fetch(new Request("http://x/photos/1/thumb", { headers: auth }), env);
  assert.deepEqual([...new Uint8Array(await thumb.arrayBuffer())], [1, 2, 3]);
  assert.equal((await worker.fetch(new Request("http://x/albums/2024-01/video", { headers: auth }), env)).status, 501);
});
