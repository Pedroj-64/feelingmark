import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { crc32, zipStream } from "../src/zip.ts";

const collect = async (s: ReadableStream<Uint8Array>) => new Uint8Array(await new Response(s).arrayBuffer());

test("crc32 coincide con el valor estándar", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test(
  "el ZIP generado lo abre unzip: nombres, contenido y CRC",
  { skip: spawnSync("unzip", ["-v"]).error ? "unzip no instalado" : false },
  async () => {
    const a = new Uint8Array(70_000).map((_, i) => i % 251); // más de un bloque, con ceros y bytes altos
    const b = new TextEncoder().encode("hola ñandú");
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(
      file,
      await collect(
        zipStream([
          { name: "2024-05-01_1.jpg", data: async () => a },
          { name: "ñ/dos.txt", data: async () => b },
        ]),
      ),
    );
    const t = spawnSync("unzip", ["-t", file], { encoding: "utf8" });
    assert.equal(t.status, 0, t.stdout + t.stderr);
    assert.match(t.stdout, /No errors detected/);
    const out = spawnSync("unzip", ["-p", file, "2024-05-01_1.jpg"], { maxBuffer: 1 << 20 });
    assert.deepEqual(new Uint8Array(out.stdout), a);
    assert.equal(readFileSync(file).length > a.length + b.length, true);
    assert.equal(spawnSync("unzip", ["-l", file], { encoding: "utf8" }).stdout.includes("dos.txt"), true);
  },
);

test("un ZIP vacío es válido", async () => {
  const z = await collect(zipStream([]));
  assert.equal(z.length, 22); // solo el registro final
});
