import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

const SHOW = 3; // segundos por foto
const FADE = 0.6; // segundos de fundido entre fotos

/** Argumentos de ffmpeg: fotos 720x720 con fundido cruzado y, si se indica, música en bucle que se apaga al final. */
export function slideshowArgs(frames: string[], out: string, music?: string): string[] {
  const n = frames.length;
  const total = n * SHOW - (n - 1) * FADE;
  const args = ["-loglevel", "error"];
  for (const f of frames) args.push("-loop", "1", "-framerate", "25", "-t", String(SHOW), "-i", f);
  if (music) args.push("-stream_loop", "-1", "-i", music);
  let filter = "";
  let last = "0:v";
  for (let i = 1; i < n; i++) {
    filter += `[${last}][${i}:v]xfade=transition=fade:duration=${FADE}:offset=${(i * (SHOW - FADE)).toFixed(2)}[v${i}];`;
    last = `v${i}`;
  }
  filter += `[${last}]format=yuv420p[v]`;
  args.push("-filter_complex", filter, "-map", "[v]");
  if (music) args.push("-map", `${n}:a`, "-af", `afade=t=out:st=${Math.max(0, total - 2).toFixed(2)}:d=2`, "-c:a", "aac", "-shortest");
  args.push("-t", total.toFixed(2), "-r", "25", "-movflags", "+faststart", out);
  return args;
}

/** Presentación en video del mes con ffmpeg. Imágenes que sharp no decodifica se omiten. */
export async function buildSlideshow(images: Uint8Array[], opts: { music?: string } = {}): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), "fm-video-"));
  try {
    const frames: string[] = [];
    for (const img of images) {
      try {
        const frame = await sharp(img)
          .rotate()
          .resize(720, 720, { fit: "contain", background: "#1F1B16" })
          .jpeg({ quality: 88 })
          .toBuffer();
        const file = join(dir, `${String(frames.length + 1).padStart(4, "0")}.jpg`);
        await writeFile(file, frame);
        frames.push(file);
      } catch {
        /* formato no decodificable (p. ej. HEIC): se omite */
      }
    }
    if (frames.length === 0) throw new Error("no decodable images");
    const out = join(dir, "out.mp4");
    try {
      await run("ffmpeg", slideshowArgs(frames, out, opts.music));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("ffmpeg-missing");
      throw e;
    }
    return new Uint8Array(await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
