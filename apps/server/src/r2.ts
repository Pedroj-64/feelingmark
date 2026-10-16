import type { StorageAdapter } from "./storage.ts";

/** Adaptador para un bucket de Cloudflare R2 (tipado mínimo, sin @cloudflare/workers-types). */
interface R2 {
  put(key: string, value: Uint8Array): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

export function r2Storage(bucket: R2): StorageAdapter {
  return {
    async put(key, data) {
      await bucket.put(key, data);
    },
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) throw new Error(`R2 object not found: ${key}`);
      return new Uint8Array(await obj.arrayBuffer());
    },
  };
}
