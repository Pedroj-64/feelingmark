import assert from "node:assert/strict";
import { test } from "node:test";
import { createMonthCache, type BlobStore } from "../src/month-cache.ts";

const mem = (): BlobStore & { raw: string | null } => {
  const s = { raw: null as string | null, load: async () => s.raw, save: async (r: string) => void (s.raw = r) };
  return s;
};
const data = (m: string) => ({ month: m, days: { [`${m}-05`]: [1, 2] }, notes: {}, video: true });

test("guarda y recupera un mes; los meses no vistos devuelven undefined", async () => {
  const c = createMonthCache(mem());
  assert.equal(await c.get("2026-10"), undefined);
  await c.set("2026-10", data("2026-10"));
  assert.deepEqual((await c.get("2026-10"))?.days, { "2026-10-05": [1, 2] });
  assert.equal(await c.get("2026-09"), undefined);
});

test("el último valor de un mes reemplaza al anterior", async () => {
  const c = createMonthCache(mem());
  await c.set("2026-10", data("2026-10"));
  await c.set("2026-10", { ...data("2026-10"), days: {} });
  assert.deepEqual((await c.get("2026-10"))?.days, {});
});

test("no crece sin límite: conserva solo los 24 meses más recientes", async () => {
  const s = mem();
  const c = createMonthCache(s);
  for (let i = 0; i < 30; i++) {
    const m = `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
    await c.set(m, data(m));
    await new Promise((r) => setTimeout(r, 2)); // marcas de tiempo distintas
  }
  assert.equal(Object.keys(JSON.parse(s.raw!)).length, 24);
  assert.equal(await c.get("2024-01"), undefined); // el más antiguo se fue
  assert.ok(await c.get("2026-06"));
});

test("un archivo corrupto no rompe: se comporta como vacío", async () => {
  const s = mem();
  s.raw = "{no es json";
  const c = createMonthCache(s);
  assert.equal(await c.get("2026-10"), undefined);
  await c.set("2026-10", data("2026-10"));
  assert.ok(await c.get("2026-10"));
});
