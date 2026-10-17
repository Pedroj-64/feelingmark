import { randomBytes } from "node:crypto";
import type { Hono } from "hono";
import QRCode from "qrcode";
import { safeEqual } from "./app.ts";

const TTL_MS = 15 * 60_000;
const MAX_FAILS = 10; // fallos por minuto antes de responder 429
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Enlace que lleva el QR: la dirección del servidor y un código de un solo uso (no el token permanente). */
export const pairingLink = (url: string, code: string) => `feelingmark://connect?u=${encodeURIComponent(url)}&c=${code}`;

/**
 * Lo que lleva el QR: un enlace web normal, para que lo lea cualquier lector (la cámara del teléfono, Google Lens, la app).
 * /pair/go abre la app con el enlace feelingmark://. Un QR con solo feelingmark:// muchas cámaras no lo reconocen.
 */
export const pairingWebLink = (url: string, code: string) => `${url.replace(/\/$/, "")}/pair/go?c=${code}`;

/**
 * Emparejamiento del teléfono sin exponer el token: el QR trae un código que se canjea una vez y caduca a los 15 min.
 * /pair muestra un QR nuevo tras escribir el token, con la dirección por la que se abrió la página (sirve también en Docker).
 * ponytail: los códigos viven en memoria (se pierden al reiniciar) y el límite de intentos es global, no por IP
 * (tras un proxy la IP no es fiable); un atacante puede bloquear el emparejamiento un minuto, nunca entrar.
 */
export function mountPairing(app: Hono, token: string) {
  const codes = new Map<string, number>();
  let fails: number[] = [];
  const blocked = () => {
    fails = fails.filter((t) => t > Date.now() - 60_000);
    return fails.length >= MAX_FAILS;
  };
  const newCode = () => {
    for (const [c, exp] of codes) if (exp < Date.now()) codes.delete(c);
    const code = randomBytes(16).toString("hex");
    codes.set(code, Date.now() + TTL_MS);
    return code;
  };

  app.post("/pair/redeem", async (c) => {
    if (blocked()) return c.json({ error: "too many attempts" }, 429);
    const { code } = await c.req.json<{ code?: unknown }>().catch(() => ({ code: undefined }));
    const exp = typeof code === "string" ? codes.get(code) : undefined;
    if (typeof code === "string") codes.delete(code); // un código, un uso
    if (exp && exp > Date.now()) return c.json({ token });
    fails.push(Date.now());
    return c.json({ error: "invalid or expired code" }, 404);
  });

  // Página a la que lleva el QR: no gasta el código (eso lo hace /pair/redeem), solo abre la app con él.
  app.get("/pair/go", (c) => {
    const es = isEs(c.req.header("accept-language"));
    const code = c.req.query("c") ?? "";
    const exp = codes.get(code);
    if (!exp || exp < Date.now())
      return c.html(
        page(
          es,
          `<h1>Feelingmark</h1><p class="e">${es ? "Este código ya se usó o caducó. Muestra un QR nuevo en tu servidor (/pair)." : "This code was already used or has expired. Show a new QR on your server (/pair)."}</p>`,
        ),
        410,
      );
    const link = esc(pairingLink(new URL(c.req.url).origin, code));
    return c.html(
      page(
        es,
        `<h1>${es ? "Abrir Feelingmark" : "Open Feelingmark"}</h1><p>${es ? "Toca el botón para conectar la app con tu servidor." : "Tap the button to connect the app to your server."}</p><a class="b" href="${link}">${es ? "Abrir en la app" : "Open in the app"}</a><p><small>${es ? "Si no pasa nada, instala la app desde la página de Releases de GitHub y vuelve a escanear." : "If nothing happens, install the app from the GitHub Releases page and scan again."}</small></p><script>location.href=${JSON.stringify(pairingLink(new URL(c.req.url).origin, code)).replace(/</g, "\\u003c")}</script>`,
      ),
    );
  });

  const page = (es: boolean, body: string) =>
    `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Feelingmark</title>
<style>body{margin:0;background:#F7F4EF;color:#1F1B16;font:16px system-ui,sans-serif}main{max-width:420px;margin:0 auto;padding:32px 16px}h1{font-weight:600;letter-spacing:-.4px}input,button{font:inherit;width:100%;box-sizing:border-box;min-height:48px;border-radius:14px;border:1px solid #756E66;padding:0 14px;margin-top:12px}button,.b{background:#B65136;color:#fff;border:0;font-weight:600}.b{display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;min-height:48px;border-radius:14px;margin-top:12px}svg{width:100%;height:auto;background:#fff;border-radius:16px}small,.e{color:#756E66}.e{color:#B65136}@media(prefers-color-scheme:dark){body{background:#16130F;color:#F2EDE4}input{background:#211D18;color:#F2EDE4}small{color:#A39B8F}.e{color:#E07A5C}}</style></head><body><main>${body}</main></body></html>`;
  const form = (es: boolean, err = "") =>
    page(
      es,
      `<h1>${es ? "Emparejar el teléfono" : "Pair your phone"}</h1><p>${es ? "Escribe el token de acceso de tu servidor (AUTH_TOKEN) para mostrar el código QR." : "Enter your server's access token (AUTH_TOKEN) to show the QR code."}</p>${err}<form method="post"><input type="password" name="token" autocomplete="off" required aria-label="AUTH_TOKEN"><button>${es ? "Mostrar QR" : "Show QR"}</button></form>`,
    );
  const isEs = (h?: string) => (h ?? "").toLowerCase().startsWith("es");

  app.get("/pair", (c) => c.html(form(isEs(c.req.header("accept-language")))));
  app.post("/pair", async (c) => {
    const es = isEs(c.req.header("accept-language"));
    if (blocked())
      return c.html(
        form(es, `<p class="e">${es ? "Demasiados intentos. Espera un minuto." : "Too many attempts. Wait a minute."}</p>`),
        429,
      );
    const given = (await c.req.parseBody()).token;
    if (typeof given !== "string" || !safeEqual(given, token)) {
      fails.push(Date.now());
      return c.html(form(es, `<p class="e">${es ? "Token incorrecto." : "Wrong token."}</p>`), 401);
    }
    const origin = new URL(c.req.url).origin;
    const svg = await QRCode.toString(pairingWebLink(origin, newCode()), { type: "svg", margin: 4 }); // margen 4: lo que pide el estándar para leerse bien
    return c.html(
      page(
        es,
        `<h1>${es ? "Escanea con la app" : "Scan with the app"}</h1>${svg}<p><small>${es ? "Abre Feelingmark → «Escanear QR». Sirve una vez y caduca en 15 minutos." : "Open Feelingmark → “Scan QR”. Works once and expires in 15 minutes."}<br>${esc(origin)}</small></p>`,
      ),
    );
  });

  return { newCode };
}
