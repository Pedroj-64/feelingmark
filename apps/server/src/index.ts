import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";
import { localStorageAdapter } from "./storage.ts";

const dbPath = process.env.DATABASE_PATH ?? "./data/feelingmark.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
let token = process.env.AUTH_TOKEN;
if (!token) {
  token = randomBytes(24).toString("hex");
  console.log(`AUTH_TOKEN no definido; token temporal / temporary token: ${token}`);
}
const app = createApp({ db: openDb(dbPath), storage: localStorageAdapter(process.env.STORAGE_PATH ?? "./data/photos"), token });
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) });
console.log(`Feelingmark server on :${process.env.PORT ?? 8787}`);
