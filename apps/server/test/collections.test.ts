import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { createApp } from "../src/app.ts";
import { openDb } from "../src/db-node.ts";
import { thumbnail } from "../src/node-tools.ts";
import type { StorageAdapter } from "../src/storage.ts";

const mem = new Map<string, Uint8Array>();
const storage: StorageAdapter = {
  put: async (k, d) => void mem.set(k, d),
  get: async (k) => mem.get(k) ?? Promise.reject(new Error("gone")),
  delete: async (k) => void mem.delete(k),
};
const app = createApp({ db: await openDb(":memory:"), storage, token: "secret", thumbnail });
const auth = { authorization: "Bearer secret" };
const json = { ...auth, "content-type": "application/json" };

let n = 0;
const photo = async (takenAt: string, extra: Record<string, string> = {}) => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: ++n * 9, g: n * 3, b: 200 } } })
    .png()
    .toBuffer();
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "a.png");
  f.append("takenAt", takenAt);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return (await (await app.request("/photos", { method: "POST", body: f, headers: auth })).json()) as { id: number };
};
const api = (path: string, method = "GET", body?: unknown) =>
  app.request(path, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) });

test("álbumes: crear, listar, renombrar, portada y quitar fotos", async () => {
  assert.equal((await app.request("/collections")).status, 401);
  assert.equal((await api("/collections", "POST", { name: "   " })).status, 400);
  const { id } = await (await api("/collections", "POST", { name: "Viaje a Cartagena" })).json();
  const a = await photo("2025-01-02T10:00:00Z");
  const b = await photo("2025-01-03T10:00:00Z");
  assert.equal((await (await api(`/collections/${id}/items`, "POST", { ids: [a.id, b.id, 9999] })).json()).added, 2); // 9999 no existe
  assert.equal((await (await api(`/collections/${id}/items`, "POST", { ids: [a.id] })).json()).added, 0); // sin duplicar
  assert.equal((await api(`/collections/${id}`, "PATCH", { cover: 9999 })).status, 400); // la portada debe ser del álbum
  assert.equal((await api(`/collections/${id}`, "PATCH", { cover: b.id, name: "Cartagena 2025" })).status, 200);
  let col = await (await api(`/collections/${id}`)).json();
  assert.equal(col.name, "Cartagena 2025");
  assert.equal(col.cover, b.id);
  assert.deepEqual(
    col.items.map((x: { id: number }) => x.id),
    [a.id, b.id],
  ); // orden cronológico
  const list = (await (await api("/collections")).json()).collections;
  assert.equal(list[0].count, 2);
  assert.equal(list[0].cover, b.id);
  assert.equal((await api(`/collections/${id}/items/${b.id}`, "DELETE")).status, 200);
  col = await (await api(`/collections/${id}`)).json();
  assert.equal(col.cover, null); // quitar la portada la limpia
  assert.equal(col.items.length, 1);
});

test("subir con collection=<id> mete la foto en el álbum, también si ya existía", async () => {
  const { id } = await (await api("/collections", "POST", { name: "Directo" })).json();
  const p = await photo("2025-02-01T10:00:00Z", { collection: String(id) });
  assert.equal((await (await api(`/collections/${id}`)).json()).items[0].id, p.id);
  const { id: id2 } = await (await api("/collections", "POST", { name: "Otro" })).json();
  // misma foto otra vez (duplicado por hash): entra al segundo álbum
  const f = new FormData();
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: n * 9, g: n * 3, b: 200 } } })
    .png()
    .toBuffer();
  f.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "a.png");
  f.append("collection", String(id2));
  const r = await app.request("/photos", { method: "POST", body: f, headers: auth });
  assert.equal((await r.json()).duplicate, true);
  assert.equal((await (await api(`/collections/${id2}`)).json()).items.length, 1);
});

test("invitación: enlace único, cuenta personas por navegador y se puede revocar", async () => {
  const { id } = await (await api("/collections", "POST", { name: "Con <b>invitados</b>" })).json();
  const a = await photo("2025-03-01T10:00:00Z");
  const other = await photo("2025-03-02T10:00:00Z"); // no está en el álbum
  await api(`/collections/${id}/items`, "POST", { ids: [a.id] });
  const inv = await (await api(`/collections/${id}/invite`, "POST")).json();
  assert.match(inv.path, /^\/i\/[0-9a-f]{24}$/);
  assert.equal((await (await api(`/collections/${id}/invite`, "POST")).json()).id, inv.id); // reutiliza el mismo
  assert.equal((await app.request("/i/inventado")).status, 404);

  const page = await app.request(inv.path); // sin token: el enlace es el permiso
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("&#60;b&#62;invitados") && !html.includes("<b>invitados")); // el nombre va escapado
  assert.ok(html.includes(`${inv.path}/thumb/${a.id}`));
  const cookie = page.headers.get("set-cookie")?.split(";")[0] ?? "";
  assert.match(cookie, /^fm_v=[0-9a-f]{24}$/);

  assert.equal((await (await api(`/collections/${id}`)).json()).people, 0); // solo abrir el HTML no cuenta (bots de vista previa)
  assert.equal((await app.request(`${inv.path}/thumb/${a.id}`, { headers: { cookie } })).status, 200);
  await app.request(`${inv.path}/photo/${a.id}`, { headers: { cookie } }); // el mismo navegador no suma otra vez
  assert.equal((await (await api(`/collections/${id}`)).json()).people, 1);
  await app.request(`${inv.path}/thumb/${a.id}`, { headers: { cookie: "fm_v=" + "ab".repeat(12) } });
  assert.equal((await (await api("/collections")).json()).collections.find((c: { id: number }) => c.id === id).people, 2);

  assert.equal((await app.request(`${inv.path}/thumb/${other.id}`, { headers: { cookie } })).status, 404); // fuera del álbum
  assert.equal((await api(`/collections/${id}/invite`, "DELETE")).status, 200);
  assert.equal((await app.request(inv.path)).status, 404);
  assert.equal((await app.request(`${inv.path}/zip`)).status, 404);
  assert.equal((await (await api(`/collections/${id}`)).json()).people, 0);
});

test(
  "descarga .zip: por invitación y con enlace firmado del dueño",
  { skip: spawnSync("unzip", ["-v"]).error ? "unzip no instalado" : false },
  async () => {
    const { id } = await (await api("/collections", "POST", { name: "Zip/prueba" })).json();
    const a = await photo("2025-04-01T10:00:00Z");
    const b = await photo("2025-04-02T10:00:00Z");
    await api(`/collections/${id}/items`, "POST", { ids: [a.id, b.id] });
    const inv = await (await api(`/collections/${id}/invite`, "POST")).json();
    const z = await app.request(`${inv.path}/zip`);
    assert.equal(z.status, 200);
    assert.equal(z.headers.get("content-type"), "application/zip");
    assert.match(z.headers.get("content-disposition") ?? "", /Zip_prueba\.zip/); // sin "/" en el nombre
    const file = join(mkdtempSync(join(tmpdir(), "alb-")), "a.zip");
    writeFileSync(file, new Uint8Array(await z.arrayBuffer()));
    const t = spawnSync("unzip", ["-l", file], { encoding: "utf8" });
    assert.match(t.stdout, new RegExp(`2025-04-01_${a.id}\\.png`));
    assert.match(t.stdout, /2 files/);
    assert.equal(spawnSync("unzip", ["-t", file]).status, 0);

    const link = await (await api(`/collections/${id}/download`, "POST")).json();
    assert.equal((await app.request(link.path)).status, 200); // sin cabecera: la firma es el permiso
    assert.equal((await app.request(link.path.replace(/sig=./, "sig=0"))).status, 403);
    assert.equal((await app.request(`/d/${id}?exp=1&sig=x`)).status, 403);
  },
);

test("borrar una foto la saca de los álbumes; borrar el álbum no borra fotos", async () => {
  const { id } = await (await api("/collections", "POST", { name: "Limpieza" })).json();
  const a = await photo("2025-05-01T10:00:00Z");
  const b = await photo("2025-05-02T10:00:00Z");
  await api(`/collections/${id}/items`, "POST", { ids: [a.id, b.id] });
  await api(`/collections/${id}`, "PATCH", { cover: a.id });
  await api(`/photos/${a.id}`, "DELETE");
  const col = await (await api(`/collections/${id}`)).json();
  assert.deepEqual(
    col.items.map((x: { id: number }) => x.id),
    [b.id],
  );
  assert.equal(col.cover, null);
  assert.equal((await api(`/collections/${id}`, "DELETE")).status, 200);
  assert.equal((await api(`/collections/${id}`)).status, 404);
  assert.equal((await app.request(`/photos/${b.id}/thumb`, { headers: auth })).status, 200); // la foto sigue
});
