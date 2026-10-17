import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { createApp } from "../src/app.ts";
import { openDb } from "../src/db-node.ts";
import { wallClock } from "../src/ingest.ts";
import { thumbnail, videoDate, videoPoster } from "../src/node-tools.ts";
import { buildSlideshow } from "../src/video.ts";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;
const skip = !hasFfmpeg && "ffmpeg/ffprobe no instalados";
const mem = new Map<string, Uint8Array>();
const app = createApp({
  db: await openDb(":memory:"),
  storage: { put: async (k, d) => void mem.set(k, d), get: async (k) => mem.get(k) ?? Promise.reject(new Error("gone")) },
  token: "t",
  thumbnail,
  videoDate,
  videoPoster,
  slideshow: buildSlideshow,
});
const auth = { authorization: "Bearer t" };

/** Un mp4 real de 2 s con fecha de grabación conocida. */
function makeVideo(creation: string): Uint8Array {
  const out = join(mkdtempSync(join(tmpdir(), "fm-v-")), "clip.mp4");
  const r = spawnSync("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=2:size=320x240:rate=15",
    "-pix_fmt",
    "yuv420p",
    "-metadata",
    `creation_time=${creation}`,
    out,
  ]);
  assert.equal(r.status, 0, String(r.stderr));
  return new Uint8Array(readFileSync(out));
}
const post = async (bytes: Uint8Array, type: string, name: string, extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.set("file", new File([bytes as Uint8Array<ArrayBuffer>], name, { type }));
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return app.request("/photos", { method: "POST", body: f, headers: auth });
};

test("un tipo no admitido se rechaza con un mensaje que menciona los videos", async () => {
  const r = await post(new Uint8Array([1]), "text/plain", "a.txt");
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /video/);
});

test("video: la fecha sale de los metadatos, tiene portada y aparece en la lista de videos del mes", { skip }, async () => {
  const video = makeVideo("2023-07-09T20:30:00Z");
  const r = await post(video, "video/mp4", "VID_19990101_000000.mp4"); // el nombre miente: manda el metadato
  assert.equal(r.status, 201);
  const { id, takenAt } = await r.json();
  assert.equal(takenAt, wallClock(new Date("2023-07-09T20:30:00Z")));
  const month = takenAt.slice(0, 7);
  const m = await (await app.request(`/photos?month=${month}`, { headers: auth })).json();
  assert.ok(m.videos.includes(id));
  const thumb = await app.request(`/photos/${id}/thumb`, { headers: auth });
  assert.equal(thumb.headers.get("content-type"), "image/jpeg");
  const meta = await sharp(Buffer.from(await thumb.arrayBuffer())).metadata();
  assert.equal(meta.width, 400);
});

test("video: Range devuelve 206 con el trozo pedido, sufijo y rango imposible", { skip }, async () => {
  const video = makeVideo("2023-08-01T10:00:00Z");
  const { id } = await (await post(video, "video/mp4", "b.mp4")).json();
  const get = (range: string) => app.request(`/photos/${id}/file`, { headers: { ...auth, range } });
  const a = await get("bytes=0-99");
  assert.equal(a.status, 206);
  assert.equal(a.headers.get("content-range"), `bytes 0-99/${video.length}`);
  assert.deepEqual(new Uint8Array(await a.arrayBuffer()), video.slice(0, 100));
  const tail = await get("bytes=-50");
  assert.equal(tail.status, 206);
  assert.deepEqual(new Uint8Array(await tail.arrayBuffer()), video.slice(-50));
  assert.equal((await get("bytes=999999999-")).status, 416);
  assert.equal((await app.request(`/photos/${id}/file`, { headers: auth })).status, 200); // sin Range: todo
});

test("el resumen en video del mes ignora los videos y usa solo las fotos", { skip }, async () => {
  const png = new Uint8Array(
    await sharp({ create: { width: 64, height: 64, channels: 3, background: "#336699" } })
      .png()
      .toBuffer(),
  );
  await post(png, "image/png", "foto.png", { takenAt: "2024-02-10T10:00:00" });
  await post(makeVideo("2024-02-11T10:00:00Z"), "video/mp4", "c.mp4");
  const r = await app.request("/albums/2024-02/video", { headers: auth });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "video/mp4");
});

test("un video sin ffmpeg ni portada responde 404 en la miniatura, no un 503", async () => {
  const bare = createApp({
    db: await openDb(":memory:"),
    storage: { put: async (k, d) => void mem.set(k, d), get: async (k) => mem.get(k)! },
    token: "t",
  });
  const f = new FormData();
  f.set("file", new File([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], "x.mp4", { type: "video/mp4" }));
  f.set("takenAt", "2024-03-03T10:00:00");
  const { id } = await (await bare.request("/photos", { method: "POST", body: f, headers: auth })).json();
  assert.equal((await bare.request(`/photos/${id}/thumb`, { headers: auth })).status, 404);
});
