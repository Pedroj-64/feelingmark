import { readFileSync } from "node:fs";
import type { Db } from "./db.ts";
import { gdriveStorage } from "./gdrive.ts";
import { getRefreshToken } from "./oauth-google.ts";
import { s3StorageAdapter } from "./s3.ts";
import { localStorageAdapter, type StorageAdapter } from "./storage.ts";

/** Credenciales de Google: GOOGLE_CREDENTIALS_FILE (el JSON que descarga Google) o GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. */
export function googleCreds() {
  const file = process.env.GOOGLE_CREDENTIALS_FILE;
  if (file) {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const c = raw.web ?? raw.installed ?? raw;
    return { clientId: String(c.client_id), clientSecret: String(c.client_secret) };
  }
  const need = (k: string) => process.env[k] || (console.error(`Falta / missing ${k}`), process.exit(1));
  return { clientId: need("GOOGLE_CLIENT_ID"), clientSecret: need("GOOGLE_CLIENT_SECRET") };
}

export function pickStorage(db: Db): StorageAdapter {
  if (process.env.STORAGE_DRIVER === "gdrive") return gdriveStorage({ ...googleCreds(), refreshToken: () => getRefreshToken(db) });
  if (process.env.STORAGE_DRIVER !== "s3") return localStorageAdapter(process.env.STORAGE_PATH ?? "./data/photos");
  const need = (k: string) => process.env[k] || (console.error(`Falta / missing ${k}`), process.exit(1));
  return s3StorageAdapter({
    endpoint: need("S3_ENDPOINT"),
    bucket: need("S3_BUCKET"),
    accessKeyId: need("S3_ACCESS_KEY_ID"),
    secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    region: process.env.S3_REGION,
  });
}
