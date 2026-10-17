import { Hono, type Context } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { MEDIA_EXT, digest, hex, ingest, isVideo } from "./ingest.ts";
import type { Db } from "./db.ts";
import type { StorageAdapter } from "./storage.ts";

const MONTH = /^\d{4}-\d{2}$/;
const END = "￿"; // cota superior para comparar prefijos de fecha ISO

const hmac = async (key: string, msg: string) => {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
};
const LINK_TTL_MS = 10 * 60_000;
const randomId = () => hex(crypto.getRandomValues(new Uint8Array(12)));
export function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ (y[i % y.length] ?? 0);
  return d === 0;
}

export type Capabilities = {
  /** Miniatura desde la foto original (solo Node, vía sharp). */
  thumbnail?: (img: Uint8Array) => Promise<Uint8Array>;
  /** Presentación en video de varias fotos (solo Node, vía ffmpeg). */
  slideshow?: (images: Uint8Array[]) => Promise<Uint8Array>;
  /** Fecha de grabación de un video (solo Node, vía ffprobe), como hora de reloj ISO. */
  videoDate?: (video: Uint8Array) => Promise<string | undefined>;
  /** Imagen de portada de un video (solo Node, vía ffmpeg). */
  videoPoster?: (video: Uint8Array) => Promise<Uint8Array>;
};

type Asset = { data: Uint8Array; mime: string };

export const DEFAULT_MAX_UPLOAD = 200 * 1024 * 1024;

export function createApp(opts: { db: Db; storage: StorageAdapter; token: string; maxUploadBytes?: number } & Capabilities) {
  const { db, storage, token } = opts;
  const app = new Hono();
  app.use("*", cors()); // el cliente web puede vivir en otro origen; el acceso lo protege el token
  const auth = bearerAuth({ token, verifyToken: (t) => safeEqual(t, token) });
  for (const p of ["/photos", "/photos/*", "/days/*", "/albums", "/albums/*", "/shares/*"]) app.use(p, auth); // la web estática queda fuera del token

  // Tope por subida (el archivo se carga entero en memoria): 413 sin leer el cuerpo si Content-Length ya lo supera.
  const limit = bodyLimit({ maxSize: opts.maxUploadBytes ?? DEFAULT_MAX_UPLOAD, onError: (c) => c.json({ error: "file too large" }, 413) });
  app.post("/photos", limit, async (c) => {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File) || !MEDIA_EXT[file.type])
      return c.json({ error: "file must be a jpeg/png/webp/heic photo or an mp4/mov/webm/3gp video" }, 400);
    const thumb = form.thumb instanceof File ? { bytes: new Uint8Array(await form.thumb.arrayBuffer()), mime: form.thumb.type } : undefined;
    const r = await ingest(
      { db, storage, videoDate: opts.videoDate },
      {
        bytes: new Uint8Array(await file.arrayBuffer()),
        mime: file.type,
        name: file.name,
        lastModified: file.lastModified,
        takenAt: form.takenAt,
        thumb,
      },
    );
    return c.json({ id: r.id, takenAt: r.takenAt, duplicate: r.duplicate }, r.duplicate ? 200 : 201);
  });

  // ?month=YYYY-MM  ->  fotos agrupadas por día (para el calendario)
  app.get("/photos", async (c) => {
    const month = c.req.query("month") ?? "";
    if (!MONTH.test(month)) return c.json({ error: "month=YYYY-MM required" }, 400);
    const rows = await db.all(
      "SELECT id, taken_at, mime FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at",
      month,
      month + END,
    );
    const days: Record<string, number[]> = {};
    const videos: number[] = []; // ids que son video (la app los muestra con ▶ y los reproduce)
    for (const r of rows) {
      (days[String(r.taken_at).slice(0, 10)] ??= []).push(Number(r.id));
      if (isVideo(String(r.mime))) videos.push(Number(r.id));
    }
    const notes: Record<string, string> = {};
    for (const r of await db.all("SELECT date, note FROM days WHERE date LIKE ?", `${month}-%`)) notes[String(r.date)] = String(r.note);
    return c.json({ month, days, notes, videos, video: Boolean(opts.slideshow) });
  });

  // Un álbum por cada mes con fotos (el más reciente primero): cuántas hay y cuál usar de portada.
  app.get("/albums", async (c) => {
    const rows = await db.all(
      "SELECT substr(taken_at, 1, 7) AS month, COUNT(*) AS count, MIN(id) AS cover FROM photos GROUP BY month ORDER BY month DESC",
    );
    return c.json({ albums: rows.map((r) => ({ month: String(r.month), count: Number(r.count), cover: Number(r.cover) })) });
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
  // Los videos admiten Range (206) para poder reproducirlos y avanzar sin descargar todo el archivo.
  const send = (c: Context, a: Asset) => {
    const base = { "content-type": a.mime, "cache-control": CACHE, "accept-ranges": "bytes" };
    const range = /^bytes=(\d*)-(\d*)$/.exec(c.req.header("range") ?? "");
    if (range && isVideo(a.mime)) {
      const total = a.data.length;
      const suffix = range[1] === "";
      const start = suffix ? total - Number(range[2]) : Number(range[1]);
      const end = suffix || range[2] === "" ? total - 1 : Math.min(Number(range[2]), total - 1);
      if (!(start >= 0 && start <= end && start < total)) return c.body(null, 416, { "content-range": `bytes */${total}` });
      return c.body(a.data.slice(start, end + 1) as Uint8Array<ArrayBuffer>, 206, {
        ...base,
        "content-range": `bytes ${start}-${end}/${total}`,
      });
    }
    return c.body(a.data as Uint8Array<ArrayBuffer>, 200, base);
  };
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
    if (isVideo(String(row.mime))) {
      // Portada de un video: se genera con ffmpeg al primer uso; sin ffmpeg no hay miniatura (la app muestra un marcador).
      const pkey = `thumbs/${row.hash}.poster`;
      const cachedPoster = await storage.get(pkey).catch(() => null);
      if (cachedPoster) return { data: cachedPoster, mime: "image/jpeg" };
      if (!opts.videoPoster) return null;
      try {
        const poster = await opts.videoPoster(await storage.get(String(row.key)));
        await storage.put(pkey, poster);
        return { data: poster, mime: "image/jpeg" };
      } catch {
        return null; // video corrupto o ffmpeg ausente
      }
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
      "SELECT id, key, hash FROM photos WHERE taken_at >= ? AND taken_at < ? AND mime LIKE 'image/%' ORDER BY taken_at, id",
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

  // Enlace firmado y de corta duración para reproducir un archivo: <video> no puede enviar la cabecera Authorization.
  // Vale solo para ese id y caduca; no revela el token (la firma es un HMAC con él).
  app.post("/photos/:id/link", async (c) => {
    const id = Number(c.req.param("id"));
    if (!(await db.get("SELECT 1 AS x FROM photos WHERE id = ?", id))) return c.json({ error: "not found" }, 404);
    const exp = Date.now() + LINK_TTL_MS;
    return c.json({ path: `/v/${id}?exp=${exp}&sig=${await hmac(token, `${id}.${exp}`)}`, expiresAt: exp });
  });
  app.get("/v/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const exp = Number(c.req.query("exp"));
    if (!(exp > Date.now()) || !safeEqual(c.req.query("sig") ?? "", await hmac(token, `${id}.${exp}`)))
      return c.json({ error: "link expired or invalid" }, 403);
    return guard(() => fileOf(id))(c);
  });
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

  // Borra la foto o el video: la fila primero (deja de verse al instante) y luego los archivos.
  // Si el almacenamiento falla quedan bytes huérfanos, pero la entrada ya no existe; mejor eso que dejarla a medias.
  app.delete("/photos/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const row = await db.get("SELECT key, hash FROM photos WHERE id = ?", id);
    if (!row) return c.json({ error: "not found" }, 404);
    await db.run("DELETE FROM photos WHERE id = ?", id);
    const keys = [String(row.key), ...["client", "webp", "poster"].map((x) => `thumbs/${row.hash}.${x}`)];
    const failed = (await Promise.allSettled(keys.map((k) => storage.delete(k)))).filter((r) => r.status === "rejected").length;
    return c.json({ ok: true, ...(failed && { orphaned: failed }) });
  });

  app.patch("/photos/:id", async (c) => {
    const { takenAt: t } = await c.req.json<{ takenAt?: string }>().catch(() => ({}) as { takenAt?: string });
    if (!t || Number.isNaN(Date.parse(t))) return c.json({ error: "takenAt ISO date required" }, 400);
    const r = await db.run("UPDATE photos SET taken_at = ? WHERE id = ?", new Date(t).toISOString(), Number(c.req.param("id")));
    return r.changes ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}
