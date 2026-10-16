import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import sharp from "sharp";
import { createApp } from "../src/app.ts";
import { openDb } from "../src/db.ts";
import type { StorageAdapter } from "../src/storage.ts";

const mem = new Map<string, Uint8Array>();
const storage: StorageAdapter = {
  put: async (k, d) => void mem.set(k, d),
  get: async (k) => {
    const v = mem.get(k);
    if (!v) throw new Error("gone");
    return v;
  },
};
const app = createApp({ db: openDb(":memory:"), storage, token: "secret" });
const auth = { authorization: "Bearer secret" };

/** JPEG mínimo con EXIF DateTimeOriginal = 2021:03:04 05:06:07 */
function jpegWithExif(): Uint8Array {
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

const upload = (bytes: Uint8Array, extra: Record<string, string> = {}, headers = auth) => {
  const f = new FormData();
  f.set("file", new File([bytes as Uint8Array<ArrayBuffer>], "a.jpg", { type: "image/jpeg", lastModified: Date.UTC(2020, 0, 2) }));
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return app.request("/photos", { method: "POST", body: f, headers });
};

test("rechaza sin token", async () => {
  assert.equal((await upload(jpegWithExif(), {}, {} as typeof auth)).status, 401);
});

test("la fecha sale del EXIF y el calendario agrupa por día", async () => {
  const r = await upload(jpegWithExif());
  assert.equal(r.status, 201);
  const month = await (await app.request("/photos?month=2021-03", { headers: auth })).json();
  assert.equal(Object.keys(month.days).length, 1);
  assert.match(Object.keys(month.days)[0], /^2021-03-0[34]$/); // depende de la zona horaria
});

test("duplicado por hash y fecha manual con prioridad; PATCH mueve de día", async () => {
  const again = await (await upload(jpegWithExif())).json();
  assert.equal(again.duplicate, true);
  const manual = await (await upload(new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]), { takenAt: "2022-07-09T12:00:00Z" })).json();
  assert.equal(manual.takenAt, "2022-07-09T12:00:00.000Z");
  await app.request(`/photos/${manual.id}`, {
    method: "PATCH",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ takenAt: "2022-08-01T00:00:00Z" }),
  });
  const aug = await (await app.request("/photos?month=2022-08", { headers: auth })).json();
  assert.deepEqual(aug.days["2022-08-01"], [manual.id]);
});

test("disco desconectado devuelve 503, no revienta", async () => {
  mem.clear();
  assert.equal((await app.request("/photos/1/file", { headers: auth })).status, 503);
});

test("responde el preflight CORS sin token", async () => {
  const r = await app.request("/photos", {
    method: "OPTIONS",
    headers: { origin: "https://x.dev", "access-control-request-method": "POST", "access-control-request-headers": "authorization" },
  });
  assert.equal(r.status, 204);
});

test("miniatura webp 400px, cacheada en el almacenamiento", async () => {
  const png = new Uint8Array(
    await sharp({ create: { width: 800, height: 600, channels: 3, background: "#c4573a" } })
      .png()
      .toBuffer(),
  );
  const { id } = await (await upload(png, { takenAt: "2023-01-05T00:00:00Z" })).json();
  const r = await app.request(`/photos/${id}/thumb`, { headers: auth });
  assert.equal(r.headers.get("content-type"), "image/webp");
  const meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [400, 400]);
  assert.ok([...mem.keys()].some((k) => k.startsWith("thumbs/")));
});

test("nota por día: crear, aparece en el mes, borrar", async () => {
  const put = (note: unknown) =>
    app.request("/days/2024-05-02", {
      method: "PUT",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
  assert.equal((await put("Día de campo")).status, 200);
  assert.equal((await (await app.request("/photos?month=2024-05", { headers: auth })).json()).notes["2024-05-02"], "Día de campo");
  await put("");
  assert.deepEqual((await (await app.request("/photos?month=2024-05", { headers: auth })).json()).notes, {});
  assert.equal((await put(42)).status, 400);
  assert.equal((await app.request("/days/2024-05-02", { method: "PUT", body: "{}" })).status, 401);
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

async function seedMonth(month: string, n: number) {
  for (let i = 0; i < n; i++) {
    const png = new Uint8Array(
      await sharp({
        create: {
          width: 64,
          height: 64,
          channels: 3,
          background: { r: 40 * i, g: 90, b: 100 + Number(month.slice(2, 4)) * 2 + Number(month.slice(5)) },
        },
      })
        .png()
        .toBuffer(),
    );
    await upload(png, { takenAt: `${month}-1${i}T12:00:00Z` });
  }
}

test("enlace compartido: público, solo ese mes, revocable", async () => {
  await seedMonth("2030-02", 2);
  await seedMonth("2030-03", 1);
  const share = await (await app.request("/albums/2030-02/share", { method: "POST", headers: auth })).json();
  assert.match(share.id, /^[0-9a-f]{24}$/);
  assert.equal((await (await app.request("/albums/2030-02/share", { method: "POST", headers: auth })).json()).id, share.id); // idempotente
  const page = await app.request(share.path); // sin token
  assert.equal(page.status, 200);
  assert.match(await page.text(), /2030-02/);
  const febIds = Object.values((await (await app.request("/photos?month=2030-02", { headers: auth })).json()).days).flat() as number[];
  const marIds = Object.values((await (await app.request("/photos?month=2030-03", { headers: auth })).json()).days).flat() as number[];
  assert.equal((await app.request(`${share.path}/thumb/${febIds[0]}`)).status, 200);
  assert.equal((await app.request(`${share.path}/photo/${marIds[0]}`)).status, 404); // otro mes
  assert.equal((await app.request("/s/ffffffffffffffffffffffff")).status, 404);
  assert.equal((await app.request("/albums/2030-02/share", { method: "POST" })).status, 401);
  assert.equal((await app.request(`/shares/${share.id}`, { method: "DELETE", headers: auth })).status, 200);
  assert.equal((await app.request(share.path)).status, 404);
});

test("video del mes: mp4 válido y cacheado", { skip: !hasFfmpeg && "ffmpeg no instalado" }, async () => {
  await seedMonth("2031-04", 2);
  const r = await app.request("/albums/2031-04/video", { headers: auth });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "video/mp4");
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.subarray(4, 8).toString(), "ftyp");
  assert.ok([...mem.keys()].some((k) => k.startsWith("videos/2031-04-")));
  assert.equal((await app.request("/albums/2031-05/video", { headers: auth })).status, 404);
});
