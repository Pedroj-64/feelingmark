/** Cola de subidas: lo pendiente sobrevive a cierres de la app y a cortes de red; se reanuda sola. */
export type Pending = {
  id: string;
  uri: string;
  mimeType?: string;
  fileName?: string | null;
  takenAt?: string;
  file?: File;
  tries: number;
};

export interface QueueStore {
  load(): Promise<Pending[]>;
  save(items: Pending[]): Promise<void>;
}

export const MAX_TRIES = 5;

export async function enqueue(store: QueueStore, items: Omit<Pending, "id" | "tries">[]) {
  const now = Date.now();
  const added = items.map((it, i) => ({ ...it, id: `${now}-${i}-${Math.random().toString(36).slice(2, 8)}`, tries: 0 }));
  await store.save([...(await store.load()), ...added]);
  return added.length;
}

/**
 * Sube en orden. Al primer fallo se detiene (probablemente no hay red) y deja el resto para el siguiente intento;
 * un archivo que falla MAX_TRIES veces se descarta para no bloquear la cola.
 */
export async function drain(
  store: QueueStore,
  upload: (p: Pending) => Promise<unknown>,
  onProgress?: (left: number) => void,
): Promise<{ done: number; dropped: number; left: number }> {
  let items = await store.load();
  let done = 0;
  let dropped = 0;
  while (items.length > 0) {
    onProgress?.(items.length);
    const [next, ...rest] = items;
    try {
      await upload(next);
      done++;
      items = rest;
    } catch {
      if (next.tries + 1 >= MAX_TRIES) {
        dropped++;
        items = rest;
      } else {
        items = [{ ...next, tries: next.tries + 1 }, ...rest];
        await store.save(items);
        break;
      }
    }
    await store.save(items);
  }
  return { done, dropped, left: items.length };
}
