import { Hono, type Context } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import exifr from "exifr";
import type { Db } from "./db.ts";
import type { StorageAdapter } from "./storage.ts";

const MONTH = /^\d{4}-\d{2}$/;
const END = "￿"; // cota superior para comparar prefijos de fecha ISO

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

// WebCrypto en lugar de node:crypto: el mismo código corre en Node y en Workers.
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
const digest = async (algo: "SHA-1" | "SHA-256", data: Uint8Array | string) =>
  hex(await crypto.subtle.digest(algo, (typeof data === "string" ? new TextEncoder().encode(data) : data) as Uint8Array<ArrayBuffer>));
const randomId = () => hex(crypto.getRandomValues(new Uint8Array(12)));
function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ (y[i % y.length] ?? 0);
  return d === 0;
}

/** Fecha de captura: la indicada por el usuario > EXIF > fecha del archivo > ahora. */
async function takenAt(bytes: Uint8Array, given: unknown, lastModified: number): Promise<string> {
  if (typeof given === "string" && !Number.isNaN(Date.parse(given))) return new Date(given).toISOString();
  const exif = await exifr.parse(bytes, ["DateTimeOriginal"]).catch(() => null);
  const d: unknown = exif?.DateTimeOriginal;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
  return new Date(lastModified || Date.now()).toISOString();
}

export type Capabilities = {
  /** Miniatura desde la foto original (solo Node, vía sharp). */
  thumbnail?: (img: Uint8Array) => Promise<Uint8Array>;
  /** Presentación en video de varias fotos (solo Node, vía ffmpeg). */
  slideshow?: (images: Uint8Array[]) => Promise<Uint8Array>;
};

type Asset = { data: Uint8Array; mime: string };

export function createApp(opts: { db: Db; storage: StorageAdapter; token: string } & Capabilities) {
  const { db, storage, token } = opts;
  const app = new Hono();
  app.use("*", cors()); // el cliente web puede vivir en otro origen; el acceso lo protege el token
  const auth = bearerAuth({ token, verifyToken: (t) => safeEqual(t, token) });
  for (const p of ["/photos", "/photos/*", "/days/*", "/albums/*", "/shares/*"]) app.use(p, auth); // la web estática queda fuera del token

  app.post("/photos", async (c) => {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File) || !EXT[file.type]) return c.json({ error: "file must be jpeg/png/webp/heic" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await digest("SHA-256", bytes);
    const dup = await db.get("SELECT id, taken_at FROM photos WHERE hash = ?", hash);
    if (dup) return c.json({ id: dup.id, takenAt: dup.taken_at, duplicate: true });
    const taken = await takenAt(bytes, form.takenAt, file.lastModified);
    const key = `${taken.slice(0, 7)}/${hash}.${EXT[file.type]}`;
    await storage.put(key, bytes);
    // Miniatura opcional hecha por el cliente (único camino en Workers, donde no hay sharp).
    const thumb = form.thumb;
    let thumbMime: string | null = null;
    if (thumb instanceof File && /^image\/(webp|jpeg)$/.test(thumb.type) && thumb.size <= 500_000) {
      await storage.put(`thumbs/${hash}.client`, new Uint8Array(await thumb.arrayBuffer()));
      thumbMime = thumb.type;
    }
    const { lastId } = await db.run(
      "INSERT INTO photos (key, hash, mime, taken_at, thumb_mime) VALUES (?,?,?,?,?)",
      key,
      hash,
      file.type,
      taken,
      thumbMime,
    );
    return c.json({ id: lastId, takenAt: taken, duplicate: false }, 201);
  });

  // ?month=YYYY-MM  ->  fotos agrupadas por día (para el calendario)
  app.get("/photos", async (c) => {
    const month = c.req.query("month") ?? "";
    if (!MONTH.test(month)) return c.json({ error: "month=YYYY-MM required" }, 400);
    const rows = await db.all("SELECT id, taken_at FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at", month, month + END);
    const days: Record<string, number[]> = {};
    for (const r of rows) (days[String(r.taken_at).slice(0, 10)] ??= []).push(Number(r.id));
    const notes: Record<string, string> = {};
    for (const r of await db.all("SELECT date, note FROM days WHERE date LIKE ?", `${month}-%`)) notes[String(r.date)] = String(r.note);
    return c.json({ month, days, notes, video: Boolean(opts.slideshow) });
  });

  // Nota de texto de un día; vacía = borrar.
  app.put("/days/:date", async (c) => {
    const date = c.req.param("date");
    const { note } = await c.req.json<{ note?: unknown }>().catch(() => ({ note: undefined }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || typeof note !== "string" || note.length > 5000)
      return c.json({ error: "invalid date or note" }, 400);
    if (note.trim() === "") await db.run("DELETE FROM days WHERE date = ?", date);
    else await db.run("INSERT INTO days (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note", date, note);
    return c.json({ ok: true });
  });

  const CACHE = "private, max-age=31536000, immutable";
  const send = (c: Context, a: Asset) => c.body(a.data as Uint8Array<ArrayBuffer>, 200, { "content-type": a.mime, "cache-control": CACHE });
  // Cualquier error de almacenamiento (p. ej. disco extraíble desconectado) se responde 503.
  const guard = (h: (c: Context) => Promise<Asset | null>) => async (c: Context) => {
    try {
      const a = await h(c);
      return a ? send(c, a) : c.json({ error: "not found" }, 404);
    } catch (e) {
      const m = (e as Error).message;
      if (m === "ffmpeg-missing") return c.json({ error: "ffmpeg is not installed on the server" }, 501);
      if (m === "video-unavailable") return c.json({ error: "video recap is not available on this deployment" }, 501);
      return c.json({ error: "storage unavailable" }, 503);
    }
  };

  const fileOf = async (id: number): Promise<Asset | null> => {
    const row = await db.get("SELECT key, mime FROM photos WHERE id = ?", id);
    return row ? { data: await storage.get(String(row.key)), mime: String(row.mime) } : null;
  };

  // Miniatura: la subida por el cliente > generada por el servidor (sharp, se guarda al primer uso) > la foto original.
  const thumbOf = async (id: number): Promise<Asset | null> => {
    const row = await db.get("SELECT key, hash, mime, thumb_mime FROM photos WHERE id = ?", id);
    if (!row) return null;
    if (row.thumb_mime) {
      const client = await storage.get(`thumbs/${row.hash}.client`).catch(() => null);
      if (client) return { data: client, mime: String(row.thumb_mime) };
    }
    const tkey = `thumbs/${row.hash}.webp`;
    const cached = await storage.get(tkey).catch(() => null);
    if (cached) return { data: cached, mime: "image/webp" };
    const original = await storage.get(String(row.key));
    if (opts.thumbnail) {
      try {
        const thumb = await opts.thumbnail(original);
        await storage.put(tkey, thumb);
        return { data: thumb, mime: "image/webp" };
      } catch {
        /* formato no decodificable (p. ej. HEIC): se sirve el original */
      }
    }
    return { data: original, mime: String(row.mime) };
  };

  // Resumen en video del mes; se genera al pedirlo y se guarda mientras las fotos del mes no cambien.
  // ponytail: sin cola; dos peticiones simultáneas generan dos veces. Añadir un lock si hace falta.
  const videoOf = async (month: string): Promise<Asset | null> => {
    const rows = await db.all(
      "SELECT id, key, hash FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at, id",
      month,
      month + END,
    );
    if (rows.length === 0) return null;
    const vkey = `videos/${month}-${(await digest("SHA-1", rows.map((r) => r.hash).join())).slice(0, 16)}.mp4`;
    const cached = await storage.get(vkey).catch(() => null);
    if (cached) return { data: cached, mime: "video/mp4" };
    if (!opts.slideshow) throw new Error("video-unavailable");
    const data = await opts.slideshow(await Promise.all(rows.map((r) => storage.get(String(r.key)))));
    await storage.put(vkey, data);
    return { data, mime: "video/mp4" };
  };

  app.get(
    "/photos/:id/file",
    guard((c) => fileOf(Number(c.req.param("id")))),
  );
  app.get(
    "/photos/:id/thumb",
    guard((c) => thumbOf(Number(c.req.param("id")))),
  );
  app.get(
    "/albums/:month/video",
    guard(async (c) => (MONTH.test(c.req.param("month") ?? "") ? videoOf(c.req.param("month") as string) : null)),
  );

  // Enlaces de solo lectura a un mes. El id aleatorio es el único secreto: quien lo tenga ve ese mes.
  app.post("/albums/:month/share", async (c) => {
    const month = c.req.param("month");
    if (!MONTH.test(month)) return c.json({ error: "month=YYYY-MM required" }, 400);
    const existing = (await db.get("SELECT id FROM shares WHERE month = ?", month))?.id as string | undefined;
    if (existing) return c.json({ id: existing, path: `/s/${existing}` });
    const id = randomId();
    await db.run("INSERT INTO shares (id, month) VALUES (?, ?)", id, month);
    return c.json({ id, path: `/s/${id}` }, 201);
  });
  app.delete("/shares/:id", async (c) =>
    (await db.run("DELETE FROM shares WHERE id = ?", c.req.param("id"))).changes
      ? c.json({ ok: true })
      : c.json({ error: "not found" }, 404),
  );

  const sharedMonth = async (id: string) => (await db.get("SELECT month FROM shares WHERE id = ?", id))?.month as string | undefined;
  const inMonth = async (month: string, photoId: number) =>
    !!(await db.get("SELECT 1 AS x FROM photos WHERE id = ? AND taken_at >= ? AND taken_at < ?", photoId, month, month + END));

  app.get("/s/:id", async (c) => {
    const month = await sharedMonth(c.req.param("id"));
    if (!month) return c.text("Not found", 404);
    const es = (c.req.header("accept-language") ?? "").toLowerCase().startsWith("es");
    const ids = (await db.all("SELECT id FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at, id", month, month + END)).map(
      (r) => Number(r.id),
    );
    const base = `/s/${c.req.param("id")}`;
    const html = `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Feelingmark ${month}</title>
<style>body{margin:0;background:#F7F4EF;color:#1F1B16;font:16px system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:24px 16px}h1{font-weight:600;letter-spacing:-.4px}a.v{color:#C4573A;font-weight:600}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:20px}.g img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}@media(prefers-color-scheme:dark){body{background:#16130F;color:#F2EDE4}a.v{color:#E07A5C}}</style></head><body><main><h1>${month}</h1><a class="v" href="${base}/video">${es ? "Ver el resumen en video" : "Watch the video recap"}</a><div class="g">${ids.map((i: number) => `<a href="${base}/photo/${i}"><img loading="lazy" src="${base}/thumb/${i}" alt=""></a>`).join("")}</div></main></body></html>`;
    return c.html(html);
  });
  const shared = (h: (c: Context, month: string) => Promise<Asset | null>) =>
    guard(async (c) => {
      const month = await sharedMonth(c.req.param("id") ?? "");
      return month ? h(c, month) : null;
    });
  app.get(
    "/s/:id/thumb/:photo",
    shared(async (c, m) => ((await inMonth(m, Number(c.req.param("photo")))) ? thumbOf(Number(c.req.param("photo"))) : null)),
  );
  app.get(
    "/s/:id/photo/:photo",
    shared(async (c, m) => ((await inMonth(m, Number(c.req.param("photo")))) ? fileOf(Number(c.req.param("photo"))) : null)),
  );
  app.get(
    "/s/:id/video",
    shared((_, m) => videoOf(m)),
  );

  app.patch("/photos/:id", async (c) => {
    const { takenAt: t } = await c.req.json<{ takenAt?: string }>().catch(() => ({}) as { takenAt?: string });
    if (!t || Number.isNaN(Date.parse(t))) return c.json({ error: "takenAt ISO date required" }, 400);
    const r = await db.run("UPDATE photos SET taken_at = ? WHERE id = ?", new Date(t).toISOString(), Number(c.req.param("id")));
    return r.changes ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}
