import { createHash } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import exifr from "exifr";
import type { Db } from "./db.ts";
import type { StorageAdapter } from "./storage.ts";

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
  app.use("*", bearerAuth({ token, verifyToken: (t) => t.length === token.length && timingSafeEqual(Buffer.from(t), Buffer.from(token)) }));

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
    const { lastInsertRowid } = db.prepare("INSERT INTO photos (key, hash, mime, taken_at) VALUES (?,?,?,?)").run(key, hash, file.type, taken);
    return c.json({ id: Number(lastInsertRowid), takenAt: taken, duplicate: false }, 201);
  });

  // ?month=YYYY-MM  ->  fotos agrupadas por día (para el calendario)
  app.get("/photos", (c) => {
    const month = c.req.query("month") ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ error: "month=YYYY-MM required" }, 400);
    const rows = db.prepare("SELECT id, taken_at FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at").all(`${month}`, `${month}￿`);
    const days: Record<string, number[]> = {};
    for (const r of rows) (days[String(r.taken_at).slice(0, 10)] ??= []).push(Number(r.id));
    return c.json({ month, days });
  });

  app.get("/photos/:id/file", async (c) => {
    const row = db.prepare("SELECT key, mime FROM photos WHERE id = ?").get(Number(c.req.param("id")));
    if (!row) return c.json({ error: "not found" }, 404);
    try {
      return c.body((await storage.get(String(row.key))) as Uint8Array<ArrayBuffer>, 200, { "content-type": String(row.mime), "cache-control": "private, max-age=31536000, immutable" });
    } catch {
      return c.json({ error: "storage unavailable" }, 503); // p. ej. disco extraíble desconectado
    }
  });

  app.patch("/photos/:id", async (c) => {
    const { takenAt: t } = await c.req.json<{ takenAt?: string }>().catch(() => ({} as { takenAt?: string }));
    if (!t || Number.isNaN(Date.parse(t))) return c.json({ error: "takenAt ISO date required" }, 400);
    const r = db.prepare("UPDATE photos SET taken_at = ? WHERE id = ?").run(new Date(t).toISOString(), Number(c.req.param("id")));
    return r.changes ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}
