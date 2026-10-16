import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

/** Presentación 720x720 (2 s por foto) con ffmpeg. Imágenes que sharp no decodifica se omiten. */
export async function buildSlideshow(images: Uint8Array[]): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), "fm-video-"));
  try {
    let n = 0;
    for (const img of images) {
      try {
        const frame = await sharp(img)
          .rotate()
          .resize(720, 720, { fit: "contain", background: "#1F1B16" })
          .jpeg({ quality: 88 })
          .toBuffer();
        await writeFile(join(dir, `${String(++n).padStart(4, "0")}.jpg`), frame);
      } catch {
        n--;
      }
    }
    if (n === 0) throw new Error("no decodable images");
    const out = join(dir, "out.mp4");
    await run("ffmpeg", [
      "-loglevel",
      "error",
      "-framerate",
      "1/2",
      "-i",
      join(dir, "%04d.jpg"),
      "-vf",
      "format=yuv420p",
      "-r",
      "25",
      "-movflags",
      "+faststart",
      out,
    ]);
    return new Uint8Array(await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
