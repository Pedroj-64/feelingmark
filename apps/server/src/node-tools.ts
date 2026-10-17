import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

/** Miniatura 400x400 webp. Solo en Node: sharp no corre en Cloudflare Workers. */
export async function thumbnail(img: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp(img).rotate().resize(400, 400, { fit: "cover" }).webp({ quality: 78 }).toBuffer());
}

const run = promisify(execFile);

/** Ejecuta fn con el video escrito en un archivo temporal (ffmpeg/ffprobe necesitan una ruta). */
async function withTempVideo<T>(video: Uint8Array, fn: (file: string, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "fm-vid-"));
  try {
    const file = join(dir, "in.bin");
    await writeFile(file, video);
    return await fn(file, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Fecha de grabación (creation_time) como hora de reloj del servidor; undefined si el video no la trae. */
export async function videoDate(video: Uint8Array): Promise<string | undefined> {
  return withTempVideo(video, async (file) => {
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format_tags=creation_time",
      "-of",
      "default=nw=1:nk=1",
      file,
    ]);
    const t = Date.parse(stdout.trim());
    if (Number.isNaN(t)) return undefined;
    const d = new Date(t);
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000Z`;
  });
}

/** Portada de un video: un fotograma (a 1 s, o el primero si dura menos) reducido a 400 px de ancho, en JPEG. */
export async function videoPoster(video: Uint8Array): Promise<Uint8Array> {
  return withTempVideo(video, async (file, dir) => {
    const out = join(dir, "poster.jpg");
    const grab = (ss: string) =>
      run("ffmpeg", ["-loglevel", "error", "-ss", ss, "-i", file, "-frames:v", "1", "-vf", "scale=400:-2", "-q:v", "4", out]);
    await grab("1").catch(() => grab("0"));
    return new Uint8Array(await readFile(out));
  });
}
