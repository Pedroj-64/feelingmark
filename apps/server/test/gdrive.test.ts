import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { authUrl, exchangeCode, gdriveStorage } from "../src/gdrive.ts";

type F = { id: string; name: string; parents: string[]; data: Buffer; folder?: boolean };

/** Drive y servidor de tokens falsos: lo justo para el adaptador. */
async function fakeGoogle() {
  const files: F[] = [];
  const stats = { tokens: 0, bearer: new Set<string>() };
  let n = 0;
  const srv = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url!, "http://x");
    const send = (o: unknown, code = 200) => (res.writeHead(code, { "content-type": "application/json" }), res.end(JSON.stringify(o)));
    if (url.pathname === "/token") {
      stats.tokens++;
      const p = new URLSearchParams(body.toString());
      if (p.get("grant_type") === "authorization_code")
        return send(
          p.get("code") === "good" ? { refresh_token: "RT", access_token: "AT", expires_in: 3600 } : { error: "invalid_grant" },
          p.get("code") === "good" ? 200 : 400,
        );
      return send(
        p.get("refresh_token") === "RT" ? { access_token: "AT", expires_in: 3600 } : { error: "invalid_grant" },
        p.get("refresh_token") === "RT" ? 200 : 400,
      );
    }
    stats.bearer.add(String(req.headers.authorization));
    if (req.headers.authorization !== "Bearer AT") return send({}, 401);
    if (req.method === "GET" && url.pathname === "/drive/v3/files" && !url.searchParams.get("alt")) {
      const qs = url.searchParams.get("q")!;
      const name = /name='((?:[^'\\]|\\.)*)'/.exec(qs)![1].replace(/\\(.)/g, "$1");
      const parent = /'([^']+)' in parents/.exec(qs)?.[1];
      const isFolder = qs.includes("google-apps.folder");
      return send({
        files: files
          .filter((f) => f.name === name && !!f.folder === isFolder && (!parent || f.parents.includes(parent)))
          .map((f) => ({ id: f.id })),
      });
    }
    if (req.method === "POST" && url.pathname === "/drive/v3/files") {
      const m = JSON.parse(body.toString());
      const f: F = { id: `id${++n}`, name: m.name, parents: [], data: Buffer.alloc(0), folder: m.mimeType?.includes("folder") };
      files.push(f);
      return send({ id: f.id });
    }
    if (req.method === "POST" && url.pathname === "/upload/drive/v3/files") {
      const boundary = /boundary=(.+)$/.exec(String(req.headers["content-type"]))![1];
      const parts = body.toString("latin1").split(`--${boundary}`).slice(1, -1);
      const meta = JSON.parse(parts[0].split("\r\n\r\n")[1].replace(/\r\n$/, ""));
      const raw = Buffer.from(parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, ""), "latin1");
      const f: F = { id: `id${++n}`, name: meta.name, parents: meta.parents, data: raw };
      files.push(f);
      return send({ id: f.id });
    }
    const id = url.pathname.split("/").pop()!;
    const f = files.find((x) => x.id === id);
    if (req.method === "DELETE" && f) return (files.splice(files.indexOf(f), 1), res.writeHead(204).end());
    if (req.method === "PATCH" && f) return ((f.data = body), send({ id }));
    if (req.method === "GET" && f && url.searchParams.get("alt") === "media") return res.end(f.data);
    send({}, 404);
  }).listen(0);
  await once(srv, "listening");
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { srv, files, stats, endpoints: { token: `${base}/token`, api: `${base}/drive/v3`, upload: `${base}/upload/drive/v3` } };
}

test("Drive: carpeta única, crear, leer y sobrescribir; el token se reutiliza", async () => {
  const g = await fakeGoogle();
  const drive = gdriveStorage({ clientId: "c", clientSecret: "s", refreshToken: async () => "RT", endpoints: g.endpoints });
  const bytes = new Uint8Array([0, 255, 10, 13, 128, 7]); // incluye CR/LF y bytes altos
  await drive.put("2024-01/a b'c.jpg", bytes);
  await drive.put("thumbs/x.webp", new Uint8Array([1]));
  assert.deepEqual([...(await drive.get("2024-01/a b'c.jpg"))], [...bytes]);
  await drive.put("2024-01/a b'c.jpg", new Uint8Array([9, 9]));
  assert.deepEqual([...(await drive.get("2024-01/a b'c.jpg"))], [9, 9]);
  assert.equal(g.files.filter((f) => f.folder).length, 1);
  assert.equal(g.files.filter((f) => !f.folder).length, 2);
  assert.ok(g.files.some((f) => f.name === "2024-01__a b'c.jpg"));
  assert.equal(g.stats.tokens, 1);
  await drive.delete("thumbs/x.webp");
  await drive.delete("thumbs/x.webp"); // ya no existe: no es un error
  assert.equal(g.files.filter((f) => !f.folder).length, 1);
  await assert.rejects(drive.get("thumbs/x.webp"));
  await assert.rejects(drive.get("no-existe"));
  g.srv.close();
});

test("Drive: sin refresh token lanza gdrive-not-connected; refresh inválido falla", async () => {
  const g = await fakeGoogle();
  await assert.rejects(
    gdriveStorage({ clientId: "c", clientSecret: "s", refreshToken: async () => undefined, endpoints: g.endpoints }).get("k"),
    /gdrive-not-connected/,
  );
  await assert.rejects(
    gdriveStorage({ clientId: "c", clientSecret: "s", refreshToken: async () => "BAD", endpoints: g.endpoints }).get("k"),
    /token refresh/,
  );
  g.srv.close();
});

test("OAuth: URL de consentimiento y canje del código", async () => {
  const g = await fakeGoogle();
  const u = new URL(authUrl({ clientId: "cid", clientSecret: "s" }, "http://localhost:8787/oauth/google/callback", "st"));
  assert.equal(u.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("state"), "st");
  assert.equal(await exchangeCode({ clientId: "c", clientSecret: "s" }, "http://r", "good", g.endpoints), "RT");
  await assert.rejects(exchangeCode({ clientId: "c", clientSecret: "s" }, "http://r", "bad", g.endpoints));
  g.srv.close();
});

test("OAuth: start exige token, el callback valida state y guarda el refresh token", async () => {
  const { Hono } = await import("hono");
  const { openDb } = await import("../src/db-node.ts");
  const { getRefreshToken, mountGoogleOAuth } = await import("../src/oauth-google.ts");
  const db = await openDb(":memory:");
  const app = new Hono();
  mountGoogleOAuth(app, { db, creds: { clientId: "cid", clientSecret: "s" }, redirectBase: "http://localhost:8787", token: "tk" });
  assert.equal((await app.request("/oauth/google/start?token=bad")).status, 401);
  const start = await app.request("/oauth/google/start?token=tk");
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  assert.equal((await app.request("/oauth/google/callback?code=x&state=forged")).status, 400); // state inventado
  assert.equal(await getRefreshToken(db), undefined);
  const denied = await app.request(`/oauth/google/callback?error=access_denied&state=${state}`);
  assert.equal(denied.status, 400);
  assert.equal((await app.request(`/oauth/google/callback?code=x&state=${state}`)).status, 400); // state de un solo uso
});
