import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { openDb } from "../src/db-node.ts";
import { formatReport, importFolder, warnings, type ImportReport } from "../src/import.ts";
import { videoDate } from "../src/node-tools.ts";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

/** JPEG mínimo con EXIF DateTimeOriginal = 2021:03:04 05:06:07 */
function jpegWithExif(): Buffer {
  const date = Buffer.from("2021:03:04 05:06:07\0", "latin1");
  const tiff = Buffer.alloc(44 + date.length);
  tiff.write("II", 0);
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8769, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(1, 26);
  tiff.writeUInt16LE(0x9003, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(20, 32);
  tiff.writeUInt32LE(44, 36);
  date.copy(tiff, 44);
  const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]);
}
const jpg = (r: number) =>
  sharp({ create: { width: 32, height: 32, channels: 3, background: { r, g: 90, b: 140 } } })
    .jpeg()
    .toBuffer();

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "fm-imp-"));
  mkdirSync(join(dir, "Dots", "2024"), { recursive: true });
  mkdirSync(join(dir, ".thumbnails"));
  writeFileSync(join(dir, "Dots", "IMG_20240315_101500.jpg"), await jpg(10)); // nombre con fecha
  writeFileSync(join(dir, "Dots", "2024", "con-exif.JPG"), jpegWithExif()); // extensión en mayúsculas + EXIF
  const noDate = join(dir, "sin-fecha.jpg");
  writeFileSync(noDate, await jpg(60));
  utimesSync(noDate, new Date(2022, 6, 4, 9, 30), new Date(2022, 6, 4, 9, 30)); // solo la fecha del archivo
  copyFileSync(join(dir, "Dots", "IMG_20240315_101500.jpg"), join(dir, "copia.jpg")); // duplicado exacto
  writeFileSync(join(dir, "notas.txt"), "no soy una foto");
  writeFileSync(join(dir, ".thumbnails", "x.jpg"), await jpg(99)); // carpeta oculta: se ignora
  if (hasFfmpeg) {
    const r = spawnSync("ffmpeg", [
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:size=160x120:rate=10",
      "-pix_fmt",
      "yuv420p",
      "-metadata",
      "creation_time=2023-07-09T20:30:00Z",
      join(dir, "Dots", "clip.mp4"),
    ]);
    assert.equal(r.status, 0);
  }
  return dir;
}
const memStorage = () => {
  const m = new Map<string, Uint8Array>();
  return { m, put: async (k: string, d: Uint8Array) => void m.set(k, d), get: async (k: string) => m.get(k)! };
};

test("simulación: informa sin escribir nada, con la fuente de cada fecha", async () => {
  const dir = await fixture();
  const st = memStorage();
  const db = await openDb(":memory:");
  const r = await importFolder(dir, { db, storage: st, videoDate }, { dryRun: true });
  assert.equal(st.m.size, 0, "la simulación no debe guardar archivos");
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM photos"))?.n, 0, "ni filas");
  assert.equal(r.skipped, 1); // notas.txt (la carpeta oculta ni se recorre)
  assert.equal(r.duplicates, 1);
  assert.equal(r.bySource.filename, 1);
  assert.equal(r.bySource.exif, 1);
  assert.equal(r.bySource.file, 1);
  if (hasFfmpeg) {
    assert.equal(r.videos, 1);
    assert.equal(r.bySource.video, 1);
  }
  assert.equal(r.byMonth["2024-03"], 1);
  assert.equal(r.byMonth["2021-03"], 1);
  assert.equal(r.byMonth["2022-07"], 1);
  assert.match(formatReport(r, true), /SIMULACIÓN.*\n[\s\S]*--apply/);
});

test("importar guarda todo y repetirlo no duplica nada", async () => {
  const dir = await fixture();
  const st = memStorage();
  const db = await openDb(":memory:");
  const first = await importFolder(dir, { db, storage: st, videoDate }, { dryRun: false });
  const expected = 3 + (hasFfmpeg ? 1 : 0);
  assert.equal(first.imported, expected);
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM photos"))?.n, expected);
  const second = await importFolder(dir, { db, storage: st, videoDate }, { dryRun: false });
  assert.equal(second.imported, 0);
  assert.equal(second.duplicates, expected + 1); // + la copia
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM photos"))?.n, expected);
});

test("avisos: todo en un solo día o casi todo sin metadatos", () => {
  const base: ImportReport = {
    scanned: 100,
    imported: 0,
    duplicates: 0,
    errors: [],
    skipped: 0,
    photos: 100,
    videos: 0,
    bySource: { user: 0, exif: 100, video: 0, filename: 0, file: 0 },
    byMonth: {},
    byDay: { "2026-10-16": 90, "2024-01-01": 10 },
  };
  assert.equal(warnings({ ...base, byDay: { "2024-01-01": 20, "2024-01-02": 20, "2024-01-03": 60 } }).length, 1);
  assert.match(warnings(base)[0], /90%.*2026-10-16/);
  assert.match(
    warnings({
      ...base,
      byDay: { a: 10, b: 10, c: 10, d: 10, e: 10, f: 10, g: 10, h: 10, i: 10, j: 10 },
      bySource: { ...base.bySource, exif: 40, file: 60 },
    })[0],
    /60% usa solo la fecha del archivo/,
  );
  assert.deepEqual(warnings({ ...base, byDay: { a: 10, b: 10, c: 10, d: 10, e: 10, f: 10, g: 10, h: 10, i: 10, j: 10 } }), []);
});
