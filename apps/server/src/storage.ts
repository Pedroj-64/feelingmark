import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/** Donde viven los bytes de las fotos. Adaptadores futuros: S3/R2, Drive. */
export interface StorageAdapter {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  /** Borra el objeto; si no existe no es un error. */
  delete(key: string): Promise<void>;
}

export function localStorageAdapter(root: string): StorageAdapter {
  const base = resolve(root);
  const path = (key: string) => {
    const p = resolve(join(base, key));
    if (!p.startsWith(base + sep)) throw new Error("invalid storage key");
    return p;
  };
  return {
    async put(key, data) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), data);
    },
    get: (key) => readFile(path(key)),
    delete: (key) => rm(path(key), { force: true }),
  };
}
