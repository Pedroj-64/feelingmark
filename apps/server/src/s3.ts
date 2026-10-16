import { AwsClient } from "aws4fetch";
import type { StorageAdapter } from "./storage.ts";

export type S3Config = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; region?: string };

/** Cualquier S3-compatible: Cloudflare R2, Backblaze B2, MinIO, AWS. Path-style para máxima compatibilidad. */
export function s3StorageAdapter(cfg: S3Config): StorageAdapter {
  const client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: cfg.region ?? "auto" });
  const url = (key: string) => `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return {
    async put(key, data) {
      const r = await client.fetch(url(key), { method: "PUT", body: data as Uint8Array<ArrayBuffer> });
      if (!r.ok) throw new Error(`S3 put ${key}: HTTP ${r.status}`);
    },
    async get(key) {
      const r = await client.fetch(url(key));
      if (!r.ok) throw new Error(`S3 get ${key}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    },
  };
}
