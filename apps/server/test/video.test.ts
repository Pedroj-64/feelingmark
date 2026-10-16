import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { buildSlideshow, slideshowArgs } from "../src/video.ts";

const has = (cmd: string) => spawnSync(cmd, ["-version"]).status === 0;
const hasFfmpeg = has("ffmpeg") && has("ffprobe");

test("argumentos: fundidos con desfase correcto y sin audio por defecto", () => {
  const a = slideshowArgs(["1.jpg", "2.jpg", "3.jpg"], "out.mp4");
  const filter = a[a.indexOf("-filter_complex") + 1];
  assert.match(filter, /\[0:v\]\[1:v\]xfade=transition=fade:duration=0\.6:offset=2\.40\[v1\]/);
  assert.match(filter, /\[v1\]\[2:v\]xfade=transition=fade:duration=0\.6:offset=4\.80\[v2\]/);
  assert.ok(!a.includes("-stream_loop") && !a.includes("-shortest"));
  assert.equal(a[a.indexOf("-t", a.indexOf("-filter_complex")) + 1], "7.80"); // 3*3 - 2*0.6
});

test("argumentos: una sola foto no usa xfade", () => {
  const filter = slideshowArgs(["1.jpg"], "o.mp4")[slideshowArgs(["1.jpg"], "o.mp4").indexOf("-filter_complex") + 1];
  assert.equal(filter, "[0:v]format=yuv420p[v]");
});

test("argumentos: con música entra en bucle, se mapea y se apaga al final", () => {
  const a = slideshowArgs(["1.jpg", "2.jpg"], "o.mp4", "m.mp3");
  assert.deepEqual(a.slice(a.indexOf("-stream_loop"), a.indexOf("-stream_loop") + 4), ["-stream_loop", "-1", "-i", "m.mp3"]);
  assert.ok(a.includes("2:a") && a.includes("-shortest"));
  assert.match(a[a.indexOf("-af") + 1], /afade=t=out:st=3\.40:d=2/); // total 5.4 s: se apaga en los últimos 2 s
});

const png = async (r: number) =>
  new Uint8Array(
    await sharp({ create: { width: 200, height: 120, channels: 3, background: { r, g: 80, b: 120 } } })
      .png()
      .toBuffer(),
  );
const probe = (file: string) => {
  const j = JSON.parse(
    spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", file]).stdout.toString(),
  );
  return { duration: Number(j.format.duration), kinds: j.streams.map((s: { codec_type: string }) => s.codec_type) as string[] };
};
const save = (bytes: Uint8Array) => {
  const f = join(mkdtempSync(join(tmpdir(), "fm-vt-")), "v.mp4");
  writeFileSync(f, bytes);
  return f;
};

test("video real: 1 y 3 fotos duran lo esperado y no llevan audio", { skip: !hasFfmpeg && "ffmpeg/ffprobe no instalados" }, async () => {
  const one = probe(save(await buildSlideshow([await png(10)])));
  assert.ok(Math.abs(one.duration - 3) < 0.3, `1 foto: ${one.duration}`);
  const three = probe(save(await buildSlideshow([await png(10), await png(90), await png(170)])));
  assert.ok(Math.abs(three.duration - 7.8) < 0.4, `3 fotos: ${three.duration}`);
  assert.deepEqual(three.kinds, ["video"]);
});

test(
  "video real con música: añade pista de audio y respeta la duración",
  { skip: !hasFfmpeg && "ffmpeg/ffprobe no instalados" },
  async () => {
    const music = join(mkdtempSync(join(tmpdir(), "fm-mu-")), "tono.mp3");
    const gen = spawnSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-q:a", "9", music]);
    assert.equal(gen.status, 0, "no se pudo generar el audio de prueba");
    const r = probe(save(await buildSlideshow([await png(10), await png(90)], { music }))); // el audio dura menos: debe repetirse
    assert.ok(r.kinds.includes("audio") && r.kinds.includes("video"));
    assert.ok(Math.abs(r.duration - 5.4) < 0.5, `duración: ${r.duration}`);
  },
);
