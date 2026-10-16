import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { openDb } from "../src/db-node.ts";

/** En Cloudflare, lo que no esté en run_worker_first lo sirve la web (index.html), no el Worker. */
test("toda ruta de la API está en run_worker_first de wrangler.jsonc", async () => {
  const config = JSON.parse(
    readFileSync("wrangler.jsonc", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n"),
  );
  const patterns: string[] = config.assets.run_worker_first;
  // "/x/*" cubre lo que empieza por "/x/" pero NO "/x" a secas (así lo trata Cloudflare); "/x" cubre solo "/x".
  const covered = (path: string) => patterns.some((p) => (p.endsWith("/*") ? path.startsWith(p.slice(0, -1)) : path === p));

  const app = createApp({ db: await openDb(":memory:"), storage: { put: async () => {}, get: async () => new Uint8Array() }, token: "t" });
  const routes = [...new Set(app.routes.map((r) => r.path))].filter((p) => p !== "/*" && !p.endsWith("/*"));
  assert.ok(routes.length > 8, "no se detectaron las rutas");
  assert.deepEqual(
    routes.filter((p) => !covered(p)),
    [],
  );
});
