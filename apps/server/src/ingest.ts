import exifr from "exifr";
import type { Db } from "./db.ts";
import type { StorageAdapter } from "./storage.ts";

/** Tipos admitidos → extensión. Fotos y videos. */
export const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};
export const isVideo = (mime: string) => mime.startsWith("video/");

/** Para nombres de archivo: mime desde la extensión (lo usa el importador). */
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(MEDIA_EXT)
    .map(([mime, ext]) => [ext, mime])
    .concat([
      ["jpeg", "image/jpeg"],
      ["jpe", "image/jpeg"],
    ]),
);

// WebCrypto en lugar de node:crypto: el mismo código corre en Node y en Workers.
export const hex = (b: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
export const digest = async (algo: "SHA-1" | "SHA-256", data: Uint8Array | string) =>
  hex(await crypto.subtle.digest(algo, (typeof data === "string" ? new TextEncoder().encode(data) : data) as Uint8Array<ArrayBuffer>));

/*
 * Las fechas se guardan como "hora de reloj" tal como la vio quien tomó la foto, etiquetada con Z
 * (2024-03-15T21:05:00.000Z = las 9:05 pm de ese día), SIN convertir zonas horarias. Así el día del calendario
 * es el de la cámara, venga del EXIF, del nombre del archivo o del servidor, sin importar la zona del servidor.
 */
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
export const wallClock = (d: Date) =>
  `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000Z`;

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const valid = (y: number, mo: number, d: number) => {
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
};

/** Fecha indicada por el usuario/cliente: sin zona se toma como hora de reloj; con zona se respeta el instante. */
export function parseGiven(given: unknown): string | undefined {
  if (typeof given !== "string") return undefined;
  const m = NAIVE.exec(given.trim());
  if (m) return valid(+m[1], +m[2], +m[3]) ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}.000Z` : undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(given.trim());
  if (day) return valid(+day[1], +day[2], +day[3]) ? `${given.trim()}T12:00:00.000Z` : undefined;
  const t = Date.parse(given);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/** IMG_20240315_101500.jpg, PXL_20240315_..., 2024-03-15 10.15.00, VID-20240315-WA0001.mp4... */
export function dateFromFilename(name: string): string | undefined {
  const m =
    /(?<!\d)((?:19|20)\d{2})[-_. ]?(0[1-9]|1[0-2])[-_. ]?(0[1-9]|[12]\d|3[01])(?:[-_. T]?([01]\d|2[0-3])[-_.: ]?([0-5]\d)[-_.: ]?([0-5]\d)(?:\d{1,3})?)?(?!\d)/.exec(
      name,
    );
  if (!m || !valid(+m[1], +m[2], +m[3])) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "12"}:${m[5] ?? "00"}:${m[6] ?? "00"}.000Z`;
}

export type DateSource = "user" | "exif" | "video" | "filename" | "file";

export async function resolveTakenAt(
  bytes: Uint8Array,
  mime: string,
  o: { given?: unknown; name?: string; lastModified?: number; videoDate?: (b: Uint8Array) => Promise<string | undefined> },
): Promise<{ iso: string; source: DateSource }> {
  const given = parseGiven(o.given);
  if (given) return { iso: given, source: "user" };
  if (!isVideo(mime)) {
    // reviveValues:false → el texto crudo "2021:03:04 05:06:07", sin que exifr lo interprete en la zona del servidor.
    const exif = await exifr.parse(bytes, { pick: ["DateTimeOriginal"], reviveValues: false }).catch(() => null);
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(exif?.DateTimeOriginal ?? ""));
    if (m && valid(+m[1], +m[2], +m[3])) return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`, source: "exif" };
  } else if (o.videoDate) {
    const v = await o.videoDate(bytes).catch(() => undefined);
    if (v) return { iso: v, source: "video" };
  }
  const named = o.name ? dateFromFilename(o.name) : undefined;
  if (named) return { iso: named, source: "filename" };
  return { iso: wallClock(new Date(o.lastModified || Date.now())), source: "file" };
}

export type IngestInput = {
  bytes: Uint8Array;
  mime: string;
  name?: string;
  lastModified?: number;
  takenAt?: unknown;
  thumb?: { bytes: Uint8Array; mime: string };
};
export type IngestResult = { id: number; takenAt: string; duplicate: boolean; source?: DateSource };

/** Guarda un archivo y su fila; si ya existe (mismo contenido) devuelve el existente. Lo usan la API y el importador. */
export async function ingest(
  deps: { db: Db; storage: StorageAdapter; videoDate?: (b: Uint8Array) => Promise<string | undefined> },
  input: IngestInput,
): Promise<IngestResult> {
  const { db, storage } = deps;
  const hash = await digest("SHA-256", input.bytes);
  const dup = await db.get("SELECT id, taken_at FROM photos WHERE hash = ?", hash);
  if (dup) return { id: Number(dup.id), takenAt: String(dup.taken_at), duplicate: true };
  const { iso, source } = await resolveTakenAt(input.bytes, input.mime, {
    given: input.takenAt,
    name: input.name,
    lastModified: input.lastModified,
    videoDate: deps.videoDate,
  });
  const key = `${iso.slice(0, 7)}/${hash}.${MEDIA_EXT[input.mime]}`;
  await storage.put(key, input.bytes);
  let thumbMime: string | null = null;
  if (input.thumb && /^image\/(webp|jpeg)$/.test(input.thumb.mime) && input.thumb.bytes.length <= 500_000) {
    await storage.put(`thumbs/${hash}.client`, input.thumb.bytes);
    thumbMime = input.thumb.mime;
  }
  const { lastId } = await db.run(
    "INSERT INTO photos (key, hash, mime, taken_at, thumb_mime) VALUES (?,?,?,?,?)",
    key,
    hash,
    input.mime,
    iso,
    thumbMime,
  );
  return { id: lastId, takenAt: iso, duplicate: false, source };
}
