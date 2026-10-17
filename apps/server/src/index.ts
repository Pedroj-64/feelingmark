import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import qrcode from "qrcode-terminal";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { openDb } from "./db-node.ts";
import { thumbnail, videoDate, videoPoster } from "./node-tools.ts";
import { buildSlideshow } from "./video.ts";
import { mountPairing, pairingLink } from "./pair.ts";
import { getRefreshToken, mountGoogleOAuth } from "./oauth-google.ts";
import { googleCreds, pickStorage } from "./storage-env.ts";

const dbPath = process.env.DATABASE_PATH ?? "./data/feelingmark.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
let token = process.env.AUTH_TOKEN;
if (!token) {
  token = randomBytes(24).toString("hex");
  console.log(`AUTH_TOKEN no definido; token temporal / temporary token: ${token}`);
}
// Música opcional para el video del mes: VIDEO_MUSIC_FILE=/ruta/a/tu/audio.mp3 (usa un audio del que tengas derechos).
let music = process.env.VIDEO_MUSIC_FILE;
if (music && !existsSync(music)) {
  console.warn(`VIDEO_MUSIC_FILE no existe / not found: ${music} (el video saldrá sin música / video will have no music)`);
  music = undefined;
}
const db = await openDb(dbPath);
const app = createApp({
  db,
  storage: pickStorage(db),
  token,
  maxUploadBytes: process.env.MAX_UPLOAD_MB ? Number(process.env.MAX_UPLOAD_MB) * 1024 * 1024 : undefined,
  thumbnail,
  videoDate,
  videoPoster,
  slideshow: (imgs) => buildSlideshow(imgs, { music }),
});
const pairing = mountPairing(app, token);
if (process.env.STORAGE_DRIVER === "gdrive") {
  const redirectBase = process.env.GOOGLE_REDIRECT_BASE || `http://localhost:${process.env.PORT ?? 8787}`;
  mountGoogleOAuth(app, { db, creds: googleCreds(), redirectBase, token });
  if (!(await getRefreshToken(db)))
    console.log(`\nGoogle Drive sin autorizar. Abre / Open: ${redirectBase}/oauth/google/start?token=${token}\n`);
}
// WEB_DIR: carpeta exportada con `expo export -p web`; el mismo servidor entrega la web.
if (process.env.WEB_DIR) {
  app.use("/*", serveStatic({ root: process.env.WEB_DIR }));
  app.get("*", serveStatic({ path: `${process.env.WEB_DIR}/index.html` }));
}
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) });
console.log(`Feelingmark server on :${process.env.PORT ?? 8787}`);

// QR de emparejamiento: al escanearlo con la cámara del teléfono, la app abre una pantalla para confirmar la conexión.
// En Docker la IP detectada es la del contenedor: define PUBLIC_URL (p. ej. http://192.168.1.10:8787).
const lan =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i?.family === "IPv4" && !i.internal)?.address ?? "localhost";
const publicUrl = process.env.PUBLIC_URL || `http://${lan}:${process.env.PORT ?? 8787}`;
const port = process.env.PORT ?? 8787;
console.log(`\nEmparejar el teléfono / Pair your phone (${publicUrl}) — código de un solo uso, 15 min / one-time code, 15 min:`);
qrcode.generate(pairingLink(publicUrl, pairing.newCode()), { small: true });
console.log(`¿Otro QR más tarde? / Need another QR later? ${publicUrl.replace(/\/$/, "")}/pair`);
// Dentro de Docker la IP detectada es la del contenedor: sin PUBLIC_URL este QR no conecta, pero /pair usa la dirección con la que lo abras.
if (!process.env.PUBLIC_URL && existsSync("/.dockerenv"))
  console.warn(
    `Docker: define PUBLIC_URL (p. ej. http://192.168.1.10:${port}) o abre http://<tu-ip>:${port}/pair / set PUBLIC_URL or open /pair`,
  );
