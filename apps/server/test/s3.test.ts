import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { s3StorageAdapter } from "../src/s3.ts";

test("S3: put/get firmados contra un servidor falso, claves con carpetas", async () => {
  const objects = new Map<string, Buffer>();
  const seen: (string | undefined)[] = [];
  const srv = createServer(async (req, res) => {
    seen.push(req.headers.authorization);
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    if (req.method === "PUT") {
      objects.set(req.url!, Buffer.concat(chunks));
      res.end();
    } else if (objects.has(req.url!)) res.end(objects.get(req.url!));
    else {
      res.statusCode = 404;
      res.end();
    }
  }).listen(0);
  await once(srv, "listening");
  const s3 = s3StorageAdapter({
    endpoint: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`,
    bucket: "b",
    accessKeyId: "AK",
    secretAccessKey: "SK",
  });
  await s3.put("2024-01/abc.jpg", new Uint8Array([1, 2, 3]));
  assert.deepEqual([...(await s3.get("2024-01/abc.jpg"))], [1, 2, 3]);
  assert.ok(objects.has("/b/2024-01/abc.jpg"));
  assert.ok(seen.every((a) => a?.startsWith("AWS4-HMAC-SHA256")));
  await assert.rejects(s3.get("nope"));
  srv.close();
});
