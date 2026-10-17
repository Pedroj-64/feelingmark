import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { createApp } from "../src/app.ts";
import { openDb } from "../src/db-node.ts";
import { thumbnail } from "../src/node-tools.ts";
import type { StorageAdapter } from "../src/storage.ts";

const mem = new Map<string, Uint8Array>();
const storage: StorageAdapter = {
  put: async (k, d) => void mem.set(k, d),
  get: async (k) => mem.get(k) ?? Promise.reject(new Error("gone")),
  delete: async (k) => void mem.delete(k),
};
const app = createApp({ db: await openDb(":memory:"), storage, token: "secret", thumbnail });
const auth = { authorization: "Bearer secret" };

const photo = async (takenAt: string, color: string) => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: color } })
    .png()
    .toBuffer();
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "a.png");
  f.append("takenAt", takenAt);
  return (await app.request("/photos", { method: "POST", body: f, headers: auth })).json() as Promise<{ id: number }>;
};
const note = (date: string, text: string) =>
  app.request(`/days/${date}`, {
    method: "PUT",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ note: text }),
  });

test("/memories devuelve el mismo día de años anteriores, el más reciente primero, y pide token", async () => {
  const a = await photo("2023-05-05T10:00:00Z", "#ff0000");
  const b = await photo("2024-05-05T10:00:00Z", "#00ff00");
  await photo("2026-05-05T10:00:00Z", "#0000ff"); // este año: no es un recuerdo
  await photo("2024-05-06T10:00:00Z", "#ffff00"); // otro día
  await note("2022-05-05", "cumpleaños");
  assert.equal((await app.request("/memories?date=2026-05-05")).status, 401);
  assert.equal((await app.request("/memories?date=mal", { headers: auth })).status, 400);
  const { memories } = await (await app.request("/memories?date=2026-05-05", { headers: auth })).json();
  assert.deepEqual(
    memories.map((m: { date: string }) => m.date),
    ["2024-05-05", "2023-05-05", "2022-05-05"],
  );
  assert.deepEqual(memories[0].ids, [b.id]);
  assert.deepEqual(memories[1].ids, [a.id]);
  assert.equal(memories[2].note, "cumpleaños");
});

test("/search encuentra notas, trata % y _ como texto y exige 2 letras", async () => {
  await note("2023-07-01", "Playa con 100% de sol");
  await note("2023-07-02", "Cine");
  const find = async (q: string) => (await (await app.request(`/search?q=${encodeURIComponent(q)}`, { headers: auth })).json()).results;
  assert.deepEqual(
    (await find("playa")).map((r: { date: string }) => r.date),
    ["2023-07-01"],
  );
  assert.equal((await find("%")).length, 0); // "%" solo no es comodín
  assert.equal((await find("100%")).length, 1);
  assert.equal((await find("p")).length, 0);
  assert.equal((await app.request("/search?q=cine")).status, 401);
});
