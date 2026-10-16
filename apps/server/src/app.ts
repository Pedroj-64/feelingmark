import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import exifr from "exifr";
import sharp from "sharp";
import type { Db } from "./db.ts";
import type { StorageAdapter } from "./storage.ts";
import { buildSlideshow } from "./video.ts";

const MONTH = /^\d{4}-\d{2}$/;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

/** Fecha de captura: la indicada por el usuario > EXIF > fecha del archivo > ahora. */
async function takenAt(bytes: Uint8Array, given: unknown, lastModified: number): Promise<string> {
  if (typeof given === "string" && !Number.isNaN(Date.parse(given))) return new Date(given).toISOString();
  const exif = await exifr.parse(bytes, ["DateTimeOriginal"]).catch(() => null);
  const d: unknown = exif?.DateTimeOriginal;
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString();
  return new Date(lastModified || Date.now()).toISOString();
}

export function createApp(opts: { db: Db; storage: StorageAdapter; token: string }) {
  const { db, storage, token } = opts;
  const app = new Hono();
  app.use("*", cors()); // el cliente web vive en otro origen; el acceso lo protege el token
  const auth = bearerAuth({ token, verifyToken: (t) => t.length === token.length && timingSafeEqual(Buffer.from(t), Buffer.from(token)) });
  app.use("/photos", auth); // la web estática (si se sirve) queda fuera del token
  app.use("/photos/*", auth);
  app.use("/days/*", auth);
  app.use("/albums/*", auth);
  app.use("/shares/*", auth);

  app.post("/photos", async (c) => {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File) || !EXT[file.type]) return c.json({ error: "file must be jpeg/png/webp/heic" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    const dup = db.prepare("SELECT id, taken_at FROM photos WHERE hash = ?").get(hash);
    if (dup) return c.json({ id: dup.id, takenAt: dup.taken_at, duplicate: true });
    const taken = await takenAt(bytes, form.takenAt, file.lastModified);
    const key = `${taken.slice(0, 7)}/${hash}.${EXT[file.type]}`;
    await storage.put(key, bytes);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO photos (key, hash, mime, taken_at) VALUES (?,?,?,?)")
      .run(key, hash, file.type, taken);
    return c.json({ id: Number(lastInsertRowid), takenAt: taken, duplicate: false }, 201);
  });

  // ?month=YYYY-MM  ->  fotos agrupadas por día (para el calendario)
  app.get("/photos", (c) => {
    const month = c.req.query("month") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ error: "month=YYYY-MM required" }, 400);
    const rows = db
      .prepare("SELECT id, taken_at FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at")
      .all(`${month}`, `${month}￿`);
    const days: Record<string, number[]> = {};
    for (const r of rows) (days[String(r.taken_at).slice(0, 10)] ??= []).push(Number(r.id));
    const notes: Record<string, string> = {};
    for (const r of db.prepare("SELECT date, note FROM days WHERE date LIKE ?").all(`${month}-%`)) notes[String(r.date)] = String(r.note);
    return c.json({ month, days, notes });
  });

  // Nota de texto de un día; vacía = borrar.
  app.put("/days/:date", async (c) => {
    const date = c.req.param("date");
    const { note } = await c.req.json<{ note?: unknown }>().catch(() => ({ note: undefined }));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || typeof note !== "string" || note.length > 5000)
      return c.json({ error: "invalid date or note" }, 400);
    if (note.trim() === "") db.prepare("DELETE FROM days WHERE date = ?").run(date);
    else db.prepare("INSERT INTO days (date, note) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET note = excluded.note").run(date, note);
    return c.json({ ok: true });
  });

  type Asset = { data: Uint8Array; mime: string };
  const CACHE = "private, max-age=31536000, immutable";
  const send = (c: Context, a: Asset) => c.body(a.data as Uint8Array<ArrayBuffer>, 200, { "content-type": a.mime, "cache-control": CACHE });
  // Cualquier error de almacenamiento (p. ej. disco extraíble desconectado) se responde 503.
  const guard = (h: (c: Context) => Promise<Asset | null>) => async (c: Context) => {
    try {
      const a = await h(c);
      return a ? send(c, a) : c.json({ error: "not found" }, 404);
    } catch {
      return c.json({ error: "storage unavailable" }, 503);
    }
  };

  const fileOf = async (id: number): Promise<Asset | null> => {
    const row = db.prepare("SELECT key, mime FROM photos WHERE id = ?").get(id);
    return row ? { data: await storage.get(String(row.key)), mime: String(row.mime) } : null;
  };

  // Miniatura 400x400 generada al primer uso y guardada junto a las fotos.
  const thumbOf = async (id: number): Promise<Asset | null> => {
    const row = db.prepare("SELECT key, hash, mime FROM photos WHERE id = ?").get(id);
    if (!row) return null;
    const tkey = `thumbs/${row.hash}.webp`;
    const cached = await storage.get(tkey).catch(() => null);
    if (cached) return { data: cached, mime: "image/webp" };
    const original = await storage.get(String(row.key));
    try {
      const thumb = new Uint8Array(await sharp(original).rotate().resize(400, 400, { fit: "cover" }).webp({ quality: 78 }).toBuffer());
      await storage.put(tkey, thumb);
      return { data: thumb, mime: "image/webp" };
    } catch {
      return { data: original, mime: String(row.mime) }; // formato que sharp no decodifica (p. ej. HEIC)
    }
  };

  // Resumen en video del mes; se genera al pedirlo y se guarda mientras las fotos del mes no cambien.
  // ponytail: sin cola; dos peticiones simultáneas generan dos veces. Añadir un lock si hace falta.
  const videoOf = async (month: string): Promise<Asset | null> => {
    const rows = db
      .prepare("SELECT id, key, hash FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at, id")
      .all(month, `${month}\uffff`);
    if (rows.length === 0) return null;
    const vkey = `videos/${month}-${createHash("sha1")
      .update(rows.map((r) => r.hash).join())
      .digest("hex")
      .slice(0, 16)}.mp4`;
    const cached = await storage.get(vkey).catch(() => null);
    if (cached) return { data: cached, mime: "video/mp4" };
    const data = await buildSlideshow(await Promise.all(rows.map((r) => storage.get(String(r.key)))));
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
    guard((c) => (MONTH.test(c.req.param("month") ?? "") ? videoOf(c.req.param("month") as string) : Promise.resolve(null))),
  );

  // Enlaces de solo lectura a un mes. El id aleatorio es el único secreto: quien lo tenga ve ese mes.
  app.post("/albums/:month/share", (c) => {
    const month = c.req.param("month");
    if (!MONTH.test(month)) return c.json({ error: "month=YYYY-MM required" }, 400);
    const existing = db.prepare("SELECT id FROM shares WHERE month = ?").get(month)?.id as string | undefined;
    if (existing) return c.json({ id: existing, path: `/s/${existing}` });
    const id = randomBytes(12).toString("hex");
    db.prepare("INSERT INTO shares (id, month) VALUES (?, ?)").run(id, month);
    return c.json({ id, path: `/s/${id}` }, 201);
  });
  app.delete("/shares/:id", (c) =>
    db.prepare("DELETE FROM shares WHERE id = ?").run(c.req.param("id")).changes
      ? c.json({ ok: true })
      : c.json({ error: "not found" }, 404),
  );

  const sharedMonth = (id: string) => db.prepare("SELECT month FROM shares WHERE id = ?").get(id)?.month as string | undefined;
  const inMonth = (month: string, photoId: number) =>
    !!db.prepare("SELECT 1 FROM photos WHERE id = ? AND taken_at >= ? AND taken_at < ?").get(photoId, month, `${month}\uffff`);

  app.get("/s/:id", (c) => {
    const month = sharedMonth(c.req.param("id"));
    if (!month) return c.text("Not found", 404);
    const es = (c.req.header("accept-language") ?? "").toLowerCase().startsWith("es");
    const ids = db
      .prepare("SELECT id FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at, id")
      .all(month, `${month}\uffff`)
      .map((r) => Number(r.id));
    const base = `/s/${c.req.param("id")}`;
    const html = `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>Feelingmark ${month}</title>
<style>body{margin:0;background:#F7F4EF;color:#1F1B16;font:16px system-ui,sans-serif}main{max-width:900px;margin:0 auto;padding:24px 16px}h1{font-weight:600;letter-spacing:-.4px}a.v{color:#C4573A;font-weight:600}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:20px}.g img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}@media(prefers-color-scheme:dark){body{background:#16130F;color:#F2EDE4}a.v{color:#E07A5C}}</style></head><body><main><h1>${month}</h1><a class="v" href="${base}/video">${es ? "Ver el resumen en video" : "Watch the video recap"}</a><div class="g">${ids.map((i) => `<a href="${base}/photo/${i}"><img loading="lazy" src="${base}/thumb/${i}" alt=""></a>`).join("")}</div></main></body></html>`;
    return c.html(html);
  });
  const shared = (h: (c: Context, month: string) => Promise<Asset | null>) =>
    guard(async (c) => {
      const month = sharedMonth(c.req.param("id") ?? "");
      return month ? h(c, month) : null;
    });
  app.get(
    "/s/:id/thumb/:photo",
    shared((c, m) => (inMonth(m, Number(c.req.param("photo"))) ? thumbOf(Number(c.req.param("photo"))) : Promise.resolve(null))),
  );
  app.get(
    "/s/:id/photo/:photo",
    shared((c, m) => (inMonth(m, Number(c.req.param("photo"))) ? fileOf(Number(c.req.param("photo"))) : Promise.resolve(null))),
  );
  app.get(
    "/s/:id/video",
    shared((_, m) => videoOf(m)),
  );

  app.patch("/photos/:id", async (c) => {
    const { takenAt: t } = await c.req.json<{ takenAt?: string }>().catch(() => ({}) as { takenAt?: string });
    if (!t || Number.isNaN(Date.parse(t))) return c.json({ error: "takenAt ISO date required" }, 400);
    const r = db.prepare("UPDATE photos SET taken_at = ? WHERE id = ?").run(new Date(t).toISOString(), Number(c.req.param("id")));
    return r.changes ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}
