import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePairing, redeem } from "../src/pair.ts";

test("lee el QR nuevo (código) y el antiguo (token), y descarta lo demás", () => {
  assert.deepEqual(parsePairing("feelingmark://connect?u=http%3A%2F%2F192.168.1.10%3A8787&c=abc123"), {
    url: "http://192.168.1.10:8787",
    code: "abc123",
    token: undefined,
  });
  assert.deepEqual(parsePairing("feelingmark://connect?u=https%3A%2F%2Fmi.dominio.com%2F&t=tok"), {
    url: "https://mi.dominio.com",
    code: undefined,
    token: "tok",
  });
  for (const bad of [
    "",
    "https://example.com",
    "feelingmark://connect?u=http%3A%2F%2Fx",
    "feelingmark://connect?u=ftp%3A%2F%2Fx&c=1",
    "feelingmark://connect?u=%E0%A4%A&c=1",
  ])
    assert.equal(parsePairing(bad), null, bad);
});

test("redeem devuelve el token y falla si el servidor rechaza el código", async () => {
  const ok = (async (_u: unknown, init?: RequestInit) => {
    assert.equal(JSON.parse(String(init?.body)).code, "c1");
    return new Response(JSON.stringify({ token: "T" }));
  }) as typeof fetch;
  assert.equal(await redeem("http://s", "c1", ok), "T");
  await assert.rejects(redeem("http://s", "c1", (async () => new Response("{}", { status: 404 })) as typeof fetch));
  await assert.rejects(redeem("http://s", "c1", (async () => new Response("{}")) as typeof fetch));
});
