import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { mountPairing, pairingWebLink } from "../src/pair.ts";

const setup = () => {
  const app = new Hono();
  const pairing = mountPairing(app, "secret-token");
  const redeem = (code: string) =>
    app.request("/pair/redeem", { method: "POST", body: JSON.stringify({ code }), headers: { "content-type": "application/json" } });
  return { app, pairing, redeem };
};

test("el código se canjea una vez por el token y no se puede reutilizar", async () => {
  const { pairing, redeem } = setup();
  const code = pairing.newCode();
  const ok = await redeem(code);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { token: "secret-token" });
  assert.equal((await redeem(code)).status, 404);
  assert.equal((await redeem("inventado")).status, 404);
});

test("el código caduca a los 15 minutos", async () => {
  const { pairing, redeem } = setup();
  const code = pairing.newCode();
  const now = Date.now;
  Date.now = () => now() + 16 * 60_000;
  try {
    assert.equal((await redeem(code)).status, 404);
  } finally {
    Date.now = now;
  }
});

test("/pair exige el token y el QR lleva un código, nunca el token", async () => {
  const { app } = setup();
  assert.equal((await app.request("/pair")).status, 200);
  const post = (token: string) =>
    app.request("http://192.168.1.10:8787/pair", {
      method: "POST",
      body: new URLSearchParams({ token }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  assert.equal((await post("otro")).status, 401);
  const ok = await post("secret-token");
  assert.equal(ok.status, 200);
  const html = await ok.text();
  assert.ok(html.includes("<svg") && html.includes("http://192.168.1.10:8787")); // la dirección sale de cómo se abrió la página
  assert.ok(!html.includes("secret-token"));
});

test("el canje no requiere token pero tampoco filtra nada sin código válido", async () => {
  const { app } = setup();
  const r = await app.request("/pair/redeem", { method: "POST", body: "no es json" });
  assert.equal(r.status, 404);
  assert.ok(!(await r.text()).includes("secret-token"));
});

test("tras 10 intentos fallidos responde 429 y vuelve a la normalidad al minuto", async () => {
  const { pairing, redeem } = setup();
  for (let i = 0; i < 10; i++) assert.equal((await redeem("mal")).status, 404);
  const code = pairing.newCode();
  assert.equal((await redeem(code)).status, 429);
  const now = Date.now;
  Date.now = () => now() + 61_000;
  try {
    assert.equal((await redeem(code)).status, 200);
  } finally {
    Date.now = now;
  }
});

test("el QR es un enlace web que abre la app sin gastar el código", async () => {
  const { app, pairing, redeem } = setup();
  const code = pairing.newCode();
  assert.equal(pairingWebLink("http://192.168.1.6:8787/", code), `http://192.168.1.6:8787/pair/go?c=${code}`);
  const r = await app.request(`http://192.168.1.6:8787/pair/go?c=${code}`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(
    html.includes(`feelingmark://connect?u=http%3A%2F%2F192.168.1.6%3A8787&amp;c=${code}`) ||
      html.includes(`feelingmark://connect?u=http%3A%2F%2F192.168.1.6%3A8787&#38;c=${code}`),
  );
  assert.ok(!html.includes("secret-token"));
  assert.equal((await redeem(code)).status, 200); // abrir la página no lo gastó
  assert.equal((await app.request(`http://x/pair/go?c=${code}`)).status, 410); // ya canjeado
  assert.equal((await app.request("http://x/pair/go?c=inventado")).status, 410);
});

test("el QR de /pair apunta a /pair/go, nunca al token", async () => {
  const { app } = setup();
  const r = await app.request("http://192.168.1.10:8787/pair", {
    method: "POST",
    body: new URLSearchParams({ token: "secret-token" }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  assert.equal(r.status, 200);
  assert.ok(!(await r.text()).includes("secret-token"));
});
