import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import qrcode from "qrcode-terminal";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { openDb } from "./db-node.ts";
import { thumbnail } from "./node-tools.ts";
import { buildSlideshow } from "./video.ts";
import { s3StorageAdapter } from "./s3.ts";
import { localStorageAdapter } from "./storage.ts";

const dbPath = process.env.DATABASE_PATH ?? "./data/feelingmark.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
let token = process.env.AUTH_TOKEN;
if (!token) {
  token = randomBytes(24).toString("hex");
  console.log(`AUTH_TOKEN no definido; token temporal / temporary token: ${token}`);
}
function pickStorage() {
  if (process.env.STORAGE_DRIVER !== "s3") return localStorageAdapter(process.env.STORAGE_PATH ?? "./data/photos");
  const need = (k: string) => process.env[k] || (console.error(`Falta / missing ${k}`), process.exit(1));
  return s3StorageAdapter({
    endpoint: need("S3_ENDPOINT"),
    bucket: need("S3_BUCKET"),
    accessKeyId: need("S3_ACCESS_KEY_ID"),
    secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    region: process.env.S3_REGION,
  });
}

const app = createApp({ db: await openDb(dbPath), storage: pickStorage(), token, thumbnail, slideshow: buildSlideshow });
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
const link = `feelingmark://connect?u=${encodeURIComponent(publicUrl)}&t=${encodeURIComponent(token)}`;
console.log(`\nEmparejar el teléfono / Pair your phone (${publicUrl}):`);
qrcode.generate(link, { small: true });
