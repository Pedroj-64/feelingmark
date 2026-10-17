import type { Context, Hono } from "hono";
import type { Db } from "./db.ts";
import { isVideo } from "./ingest.ts";
import type { StorageAdapter } from "./storage.ts";
import { zipStream } from "./zip.ts";

type Asset = { data: Uint8Array; mime: string };
export type CollectionDeps = {
  db: Db;
  storage: StorageAdapter;
  token: string;
  guard: (h: (c: Context) => Promise<Asset | null>) => (c: Context) => Promise<Response>;
  thumbOf: (id: number) => Promise<Asset | null>;
  fileOf: (id: number) => Promise<Asset | null>;
  randomId: () => string;
  hmac: (key: string, msg: string) => Promise<string>;
  safeEqual: (a: string, b: string) => boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const LINK_TTL_MS = 10 * 60_000;
const VIEWER = /^[0-9a-f]{24}$/;

/**
 * Álbumes propios (con nombre y portada) e invitación por enlace.
 * Quien tenga el enlace /i/<id> ve el álbum y lo descarga en .zip, sin cuenta. El dueño puede revocarlo.
 * "Personas con acceso" = navegadores distintos que cargaron imágenes del enlace (cookie anónima); no hay cuentas ni permisos de escritura.
 * ponytail: la cookie se pierde al borrar datos del navegador (cuenta de nuevo) y no se distingue entre dos personas en un mismo navegador.
 */
export function mountCollections(app: Hono, d: CollectionDeps) {
  const { db } = d;
  const num = (v: string | undefined) => Number(v);
  const exists = async (id: number) => !!(await db.get("SELECT 1 AS x FROM collections WHERE id = ?", id));
  const itemsOf = (id: number) =>
    db.all(
      "SELECT p.id, p.taken_at, p.mime, p.key FROM collection_items ci JOIN photos p ON p.id = ci.photo_id WHERE ci.collection_id = ? ORDER BY p.taken_at, p.id",
      id,
    );
  const people = async (id: number) =>
    Number(
      (await db.get("SELECT COUNT(*) AS n FROM invite_views v JOIN invites i ON i.id = v.invite_id WHERE i.collection_id = ?", id))?.n ?? 0,
    );
  const inviteOf = async (id: number) => (await db.get("SELECT id FROM invites WHERE collection_id = ?", id))?.id as string | undefined;

  app.get("/collections", async (c) => {
    const rows = await db.all(
      `SELECT c.id, c.name, c.cover_id,
         (SELECT COUNT(*) FROM collection_items WHERE collection_id = c.id) AS count,
         (SELECT photo_id FROM collection_items WHERE collection_id = c.id ORDER BY added_at DESC, photo_id DESC LIMIT 1) AS latest,
         (SELECT COUNT(*) FROM invite_views v JOIN invites i ON i.id = v.invite_id WHERE i.collection_id = c.id) AS people,
         EXISTS (SELECT 1 FROM invites WHERE collection_id = c.id) AS shared
       FROM collections c ORDER BY c.id DESC`,
    );
    return c.json({
      collections: rows.map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        count: Number(r.count),
        cover: (r.cover_id ?? r.latest) == null ? null : Number(r.cover_id ?? r.latest),
        people: Number(r.people),
        shared: Boolean(Number(r.shared)),
      })),
    });
  });

  app.post("/collections", async (c) => {
    const { name } = await c.req.json<{ name?: unknown }>().catch(() => ({ name: undefined }));
    const n = typeof name === "string" ? name.trim() : "";
    if (n.length < 1 || n.length > 80) return c.json({ error: "name must be 1-80 characters" }, 400);
    const r = await db.run("INSERT INTO collections (name) VALUES (?)", n);
    return c.json({ id: r.lastId, name: n }, 201);
  });

  app.get("/collections/:id", async (c) => {
    const id = num(c.req.param("id"));
    const col = await db.get("SELECT id, name, cover_id FROM collections WHERE id = ?", id);
    if (!col) return c.json({ error: "not found" }, 404);
    const items = await itemsOf(id);
    return c.json({
      id,
      name: String(col.name),
      cover: col.cover_id == null ? null : Number(col.cover_id),
      people: await people(id),
      shared: !!(await inviteOf(id)),
      items: items.map((r) => ({ id: Number(r.id), takenAt: String(r.taken_at), video: isVideo(String(r.mime)) })),
    });
  });

  app.patch("/collections/:id", async (c) => {
    const id = num(c.req.param("id"));
    if (!(await exists(id))) return c.json({ error: "not found" }, 404);
    const body = await c.req.json<{ name?: unknown; cover?: unknown }>().catch(() => ({}) as { name?: unknown; cover?: unknown });
    if (body.name !== undefined) {
      const n = typeof body.name === "string" ? body.name.trim() : "";
      if (n.length < 1 || n.length > 80) return c.json({ error: "name must be 1-80 characters" }, 400);
      await db.run("UPDATE collections SET name = ? WHERE id = ?", n, id);
    }
    if (body.cover !== undefined) {
      if (
        body.cover !== null &&
        !(
          typeof body.cover === "number" &&
          (await db.get("SELECT 1 AS x FROM collection_items WHERE collection_id = ? AND photo_id = ?", id, body.cover))
        )
      )
        return c.json({ error: "cover must be a photo of this album or null" }, 400);
      await db.run("UPDATE collections SET cover_id = ? WHERE id = ?", body.cover, id);
    }
    return c.json({ ok: true });
  });

  app.delete("/collections/:id", async (c) => {
    const id = num(c.req.param("id"));
    if (!(await exists(id))) return c.json({ error: "not found" }, 404);
    // Borra el álbum y sus invitaciones; las fotos NO se tocan.
    await db.run("DELETE FROM invite_views WHERE invite_id IN (SELECT id FROM invites WHERE collection_id = ?)", id);
    await db.run("DELETE FROM invites WHERE collection_id = ?", id);
    await db.run("DELETE FROM collection_items WHERE collection_id = ?", id);
    await db.run("DELETE FROM collections WHERE id = ?", id);
    return c.json({ ok: true });
  });

  app.post("/collections/:id/items", async (c) => {
    const id = num(c.req.param("id"));
    if (!(await exists(id))) return c.json({ error: "not found" }, 404);
    const { ids } = await c.req.json<{ ids?: unknown }>().catch(() => ({ ids: undefined }));
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((x) => Number.isInteger(x)))
      return c.json({ error: "ids must be 1-500 integers" }, 400);
    let added = 0;
    for (const photo of ids as number[])
      added += (
        await db.run("INSERT OR IGNORE INTO collection_items (collection_id, photo_id) SELECT ?, id FROM photos WHERE id = ?", id, photo)
      ).changes;
    return c.json({ ok: true, added });
  });

  app.delete("/collections/:id/items/:photo", async (c) => {
    const id = num(c.req.param("id"));
    const photo = num(c.req.param("photo"));
    const r = await db.run("DELETE FROM collection_items WHERE collection_id = ? AND photo_id = ?", id, photo);
    if (!r.changes) return c.json({ error: "not found" }, 404);
    await db.run("UPDATE collections SET cover_id = NULL WHERE id = ? AND cover_id = ?", id, photo);
    return c.json({ ok: true });
  });

  // Invitación: un enlace por álbum (se reutiliza); borrarlo lo revoca y reinicia el conteo de personas.
  app.post("/collections/:id/invite", async (c) => {
    const id = num(c.req.param("id"));
    if (!(await exists(id))) return c.json({ error: "not found" }, 404);
    const existing = await inviteOf(id);
    if (existing) return c.json({ id: existing, path: `/i/${existing}` });
    const inv = d.randomId();
    await db.run("INSERT INTO invites (id, collection_id) VALUES (?, ?)", inv, id);
    return c.json({ id: inv, path: `/i/${inv}` }, 201);
  });
  app.delete("/collections/:id/invite", async (c) => {
    const id = num(c.req.param("id"));
    const inv = await inviteOf(id);
    if (!inv) return c.json({ error: "not found" }, 404);
    await db.run("DELETE FROM invite_views WHERE invite_id = ?", inv);
    await db.run("DELETE FROM invites WHERE id = ?", inv);
    return c.json({ ok: true });
  });

  const zipName = async (id: number) => {
    const name = String((await db.get("SELECT name FROM collections WHERE id = ?", id))?.name ?? "album").replace(/[\\/:*?"<>|\r\n]/g, "_");
    return name;
  };
  const zipOf = async (id: number) => {
    const rows = await itemsOf(id);
    const stream = zipStream(
      rows.map((r) => ({
        name: `${String(r.taken_at).slice(0, 10)}_${r.id}.${String(r.key).split(".").pop() ?? "bin"}`,
        data: () => d.storage.get(String(r.key)),
      })),
    );
    const name = await zipName(id);
    return new Response(stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.zip`,
        "cache-control": "no-store",
      },
    });
  };

  // Enlace firmado de descarga para el dueño (el navegador no puede enviar la cabecera Authorization).
  app.post("/collections/:id/download", async (c) => {
    const id = num(c.req.param("id"));
    if (!(await exists(id))) return c.json({ error: "not found" }, 404);
    const exp = Date.now() + LINK_TTL_MS;
    return c.json({ path: `/d/${id}?exp=${exp}&sig=${await d.hmac(d.token, `zip.${id}.${exp}`)}`, expiresAt: exp });
  });
  app.get("/d/:id", async (c) => {
    const id = num(c.req.param("id"));
    const exp = Number(c.req.query("exp"));
    if (!(exp > Date.now()) || !d.safeEqual(c.req.query("sig") ?? "", await d.hmac(d.token, `zip.${id}.${exp}`)))
      return c.json({ error: "link expired or invalid" }, 403);
    if (!(await exists(id))) return c.json({ error: "not found" }, 404);
    return zipOf(id);
  });

  // --- Lado del invitado: sin token, el id aleatorio del enlace es el permiso ---
  const collectionOf = async (invite: string) =>
    (await db.get("SELECT c.id, c.name FROM invites i JOIN collections c ON c.id = i.collection_id WHERE i.id = ?", invite)) as
      { id: number; name: string } | undefined;
  const viewerOf = (c: Context) => /(?:^|;\s*)fm_v=([0-9a-f]{24})/.exec(c.req.header("cookie") ?? "")?.[1];
  const inAlbum = async (col: number, photo: number) =>
    !!(await db.get("SELECT 1 AS x FROM collection_items WHERE collection_id = ? AND photo_id = ?", col, photo));

  app.get("/i/:id", async (c) => {
    const invite = c.req.param("id");
    const col = await collectionOf(invite);
    if (!col) return c.text("Not found", 404);
    const es = (c.req.header("accept-language") ?? "").toLowerCase().startsWith("es");
    const items = await itemsOf(Number(col.id));
    if (!viewerOf(c))
      c.header("set-cookie", `fm_v=${d.randomId().padEnd(24, "0").slice(0, 24)}; Path=/i; Max-Age=31536000; HttpOnly; SameSite=Lax`);
    const base = `/i/${invite}`;
    const cells = items
      .map((r) => {
        const v = isVideo(String(r.mime));
        return `<a href="${base}/photo/${r.id}"><img loading="lazy" src="${base}/thumb/${r.id}" alt="">${v ? '<span class="p">▶</span>' : ""}</a>`;
      })
      .join("");
    return c.html(`<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>${esc(col.name)}</title>
<style>body{margin:0;background:#F7F4EF;color:#1F1B16;font:16px system-ui,sans-serif}main{max-width:960px;margin:0 auto;padding:24px 16px 48px}h1{font-weight:600;letter-spacing:-.4px;margin:0 0 4px}p{color:#756E66;margin:0 0 16px}a.d{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;border-radius:14px;background:#B65136;color:#fff;font-weight:600;text-decoration:none}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:20px}.g a{position:relative}.g img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block}.p{position:absolute;left:8px;bottom:8px;color:#fff;text-shadow:0 1px 3px #0008}@media(prefers-color-scheme:dark){body{background:#16130F;color:#F2EDE4}p{color:#A39B8F}a.d{background:#E07A5C;color:#16130F}}</style></head><body><main><h1>${esc(col.name)}</h1><p>${es ? `${items.length} archivos` : `${items.length} files`}</p><a class="d" href="${base}/zip">${es ? "Descargar el álbum (.zip)" : "Download the album (.zip)"}</a><div class="g">${cells}</div></main></body></html>`);
  });

  // Se cuenta a una persona cuando su navegador pide una imagen del álbum (los bots de vista previa solo piden el HTML).
  const guest = (pick: (c: Context, photo: number) => Promise<Asset | null>) =>
    d.guard(async (c) => {
      const invite = c.req.param("id") ?? "";
      const col = await collectionOf(invite);
      const photo = num(c.req.param("photo"));
      if (!col || !(await inAlbum(Number(col.id), photo))) return null;
      const viewer = viewerOf(c);
      if (viewer && VIEWER.test(viewer))
        await db.run("INSERT OR IGNORE INTO invite_views (invite_id, viewer) VALUES (?, ?)", invite, viewer);
      return pick(c, photo);
    });
  app.get(
    "/i/:id/thumb/:photo",
    guest((_, p) => d.thumbOf(p)),
  );
  app.get(
    "/i/:id/photo/:photo",
    guest((_, p) => d.fileOf(p)),
  );
  app.get("/i/:id/zip", async (c) => {
    const col = await collectionOf(c.req.param("id"));
    return col ? zipOf(Number(col.id)) : c.text("Not found", 404);
  });
}
