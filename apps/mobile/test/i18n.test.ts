import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import en from "../src/i18n/en.ts";
import es from "../src/i18n/es.ts";

const flat = (o: Record<string, unknown>, pre = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v as Record<string, unknown>, `${pre}${k}.`) : [`${pre}${k}`]));
const base = (k: string) => k.replace(/_(one|other)$/, ""); // plurales de i18next: key_one / key_other

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? (f === "i18n" ? [] : walk(p)) : /\.tsx?$/.test(f) ? [p] : [];
  });

test("es y en tienen exactamente las mismas claves", () => {
  assert.deepEqual([...new Set(flat(es).map(base))].sort(), [...new Set(flat(en).map(base))].sort());
});

test("cada t(\"clave\") del código existe en los textos", () => {
  const known = new Set(flat(en).map(base));
  const used = new Set<string>();
  for (const f of [...walk("app"), ...walk("src")]) for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
  // claves dinámicas t(k) del mapa de botones del calendario
  for (const k of ["calendar.video", "calendar.share"]) used.add(k);
  assert.deepEqual([...used].filter((k) => !known.has(k)).sort(), []);
});

test("los plurales tienen _one y _other en ambos idiomas", () => {
  for (const lang of [en, es]) {
    const keys = flat(lang);
    for (const k of keys.filter((x) => x.endsWith("_one"))) assert.ok(keys.includes(k.replace(/_one$/, "_other")), `${k}: falta _other`);
  }
});
