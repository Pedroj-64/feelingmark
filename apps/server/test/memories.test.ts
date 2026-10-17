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

test("/timeline pagina toda la biblioteca de más reciente a más antigua, sin repetir ni saltar", async () => {
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await photo(`2020-01-0${i + 1}T10:00:00Z`, `#0${i}${i}${i}${i}${i}`)).id);
  const get = async (q: string) => (await app.request(`/timeline?${q}`, { headers: auth })).json();
  const first = await get("limit=2");
  assert.equal(first.items.length, 2);
  assert.ok(first.next);
  const seen = first.items.map((x: { id: number }) => x.id);
  let next = first.next;
  while (next) {
    const page = await get(`limit=2&cursor=${encodeURIComponent(next)}`);
    seen.push(...page.items.map((x: { id: number }) => x.id));
    next = page.next;
  }
  assert.equal(new Set(seen).size, seen.length); // sin repetidos
  for (const id of ids) assert.ok(seen.includes(id)); // sin saltos
  const dates = (await get("limit=200")).items.map((x: { takenAt: string }) => x.takenAt);
  assert.deepEqual(dates, [...dates].sort().reverse()); // orden descendente
  assert.equal((await app.request("/timeline")).status, 401);
});

test("/stats cuenta fotos, videos y notas y exige token", async () => {
  assert.equal((await app.request("/stats")).status, 401);
  const st = await (await app.request("/stats", { headers: auth })).json();
  assert.ok(st.photos >= 5 && st.videos === 0 && st.notes >= 3);
  assert.ok(st.first <= st.last);
});
