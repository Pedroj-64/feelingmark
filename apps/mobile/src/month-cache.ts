import type { MonthData } from "./api.ts";

/** Último calendario visto de cada mes, para mostrarlo cuando el servidor no responde. */
export interface BlobStore {
  load(): Promise<string | null>;
  save(raw: string): Promise<void>;
}

const MAX_MONTHS = 24; // el archivo no crece sin límite

export function createMonthCache(store: BlobStore) {
  const read = async (): Promise<Record<string, { at: number; data: MonthData }>> => {
    try {
      const raw = await store.load();
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {}; // archivo corrupto: se empieza de cero
    }
  };
  return {
    async get(month: string): Promise<MonthData | undefined> {
      return (await read())[month]?.data;
    },
    async set(month: string, data: MonthData) {
      const all = await read();
      all[month] = { at: Date.now(), data };
      const keep = Object.entries(all)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, MAX_MONTHS);
      await store.save(JSON.stringify(Object.fromEntries(keep)));
    },
  };
}
