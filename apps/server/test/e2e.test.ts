import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";

// El servidor real (src/index.ts) con disco temporal, hablando HTTP como lo hace la app.
const freePort = () =>
  new Promise<number>((res) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => res(port));
    });
  });

function start(dir: string, port: number): Promise<ChildProcess> {
  const p = spawn("node", ["src/index.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      AUTH_TOKEN: "e2e",
      STORAGE_PATH: join(dir, "photos"),
      DATABASE_PATH: join(dir, "db.sqlite"),
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  return new Promise((res, rej) => {
    p.once("exit", () => rej(new Error("el servidor terminó antes de arrancar")));
    p.stdout!.on("data", (d) => String(d).includes("Feelingmark server on") && res(p));
  });
}
const stop = (p: ChildProcess) => new Promise((res) => (p.once("exit", res), p.kill()));
const files = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [e.name])) : [];

test("e2e: subir, ver en el calendario, sobrevivir a un reinicio, borrar y dejar el disco vacío", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fm-e2e-"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const auth = { authorization: "Bearer e2e" };
  let srv = await start(dir, port);
  try {
    const png = new Uint8Array(
      await sharp({ create: { width: 40, height: 60, channels: 3, background: "#c33" } })
        .png()
        .toBuffer(),
    );
    const form = new FormData();
    form.set("file", new File([png], "p.png", { type: "image/png" }));
    form.set("takenAt", "2024-05-05T12:00:00Z");
    const up = await fetch(`${base}/photos`, { method: "POST", body: form, headers: auth });
    assert.equal(up.status, 201);
    const { id } = (await up.json()) as { id: number };

    const calendar = async () =>
      (await (await fetch(`${base}/photos?month=2024-05`, { headers: auth })).json()) as { days: Record<string, number[]> };
    assert.deepEqual((await calendar()).days, { "2024-05-05": [id] });
    assert.equal((await fetch(`${base}/photos/${id}/thumb`, { headers: auth })).status, 200);
    assert.equal((await fetch(`${base}/photos/${id}/file`)).status, 401);

    await stop(srv); // los datos viven en disco, no en el proceso
    srv = await start(dir, port);
    assert.deepEqual((await calendar()).days, { "2024-05-05": [id] });
    assert.deepEqual([...new Uint8Array(await (await fetch(`${base}/photos/${id}/file`, { headers: auth })).arrayBuffer())], [...png]);

    assert.equal((await fetch(`${base}/photos/${id}`, { method: "DELETE", headers: auth })).status, 200);
    assert.deepEqual((await calendar()).days, {});
    assert.deepEqual(files(join(dir, "photos")), []); // ni el original ni las miniaturas quedan en el disco
  } finally {
    await stop(srv);
    rmSync(dir, { recursive: true, force: true });
  }
});
