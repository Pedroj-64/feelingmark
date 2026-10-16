import type { Hono } from "hono";
import type { Db } from "./db.ts";
import { authUrl, exchangeCode, type GoogleCreds } from "./gdrive.ts";

const KEY = "google_refresh_token";
export const getRefreshToken = async (db: Db) =>
  (await db.get("SELECT value FROM settings WHERE key = ?", KEY))?.value as string | undefined;

/**
 * Autorización única de Google Drive, hecha por el dueño del servidor en el navegador:
 *   /oauth/google/start?token=<AUTH_TOKEN>  ->  consentimiento de Google  ->  /oauth/google/callback
 * El refresh token se guarda en la base de datos (nunca en el repo ni en logs).
 * Google solo admite http://localhost (o https) como redirección: autoriza desde la máquina del servidor.
 */
export function mountGoogleOAuth(app: Hono, opts: { db: Db; creds: GoogleCreds; redirectBase: string; token: string }) {
  const redirectUri = `${opts.redirectBase}/oauth/google/callback`;
  const states = new Map<string, number>(); // state -> expira (anti-CSRF)

  app.get("/oauth/google/start", (c) => {
    if (c.req.query("token") !== opts.token) return c.text("Unauthorized", 401);
    const state = crypto.randomUUID();
    states.set(state, Date.now() + 10 * 60_000);
    return c.redirect(authUrl(opts.creds, redirectUri, state));
  });

  app.get("/oauth/google/callback", async (c) => {
    const state = c.req.query("state") ?? "";
    const exp = states.get(state);
    states.delete(state);
    if (!exp || exp < Date.now()) return c.text("Invalid or expired state. Start again from /oauth/google/start", 400);
    const code = c.req.query("code");
    if (!code) return c.text(`Google denied access: ${c.req.query("error") ?? "no code"}`, 400);
    try {
      const rt = await exchangeCode(opts.creds, redirectUri, code);
      await opts.db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", KEY, rt);
      return c.html(
        '<!doctype html><meta charset=utf-8><title>Feelingmark</title><body style="font:18px system-ui;padding:2rem"><h1>Google Drive connected ✓</h1><p>You can close this tab.</p>',
      );
    } catch {
      return c.text("Could not complete the Google authorization.", 502);
    }
  });
}
