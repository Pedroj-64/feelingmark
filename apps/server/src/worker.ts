// Punto de entrada para Cloudflare Workers: D1 (SQLite) + R2 (fotos) + el cliente web como assets estáticos.
// Sin sharp ni ffmpeg: las miniaturas las sube la app y el video del mes no está disponible aquí.
import { createApp } from "./app.ts";
import { d1Db } from "./d1.ts";
import { migrate } from "./db.ts";
import { r2Storage } from "./r2.ts";

type Env = { DB: Parameters<typeof d1Db>[0]; BUCKET: Parameters<typeof r2Storage>[0]; AUTH_TOKEN?: string };

let ready: Promise<void> | undefined;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!env.AUTH_TOKEN) return new Response("AUTH_TOKEN secret is not set (wrangler secret put AUTH_TOKEN)", { status: 500 });
    const db = d1Db(env.DB);
    ready ??= migrate(db).catch((e) => {
      ready = undefined; // reintenta en la siguiente petición
      throw e;
    });
    await ready;
    return createApp({ db, storage: r2Storage(env.BUCKET), token: env.AUTH_TOKEN }).fetch(req);
  },
};
