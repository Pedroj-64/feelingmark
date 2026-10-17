import * as ImagePicker from "expo-image-picker";
import type { Api } from "./api";
import { drain, enqueue } from "./queue";
import { queueStore } from "./queue-store";

// "2021:03:04 05:06:07" -> hora local ISO sin zona
const exifDate = (v: unknown) => (typeof v === "string" ? v.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T") : undefined);

/** Abre la galería del sistema (fotos y videos, varios a la vez) y deja lo elegido en la cola. Con `forDate` (AAAA-MM-DD) todo cae en ese día; con `collection`, además entra a ese álbum. Devuelve cuántos. */
export async function pickAndEnqueue(forDate?: string, collection?: number): Promise<number> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, exif: true });
  if (res.canceled) return 0;
  markPreparing();
  return enqueue(
    queueStore,
    res.assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType,
      fileName: a.fileName,
      file: a.file,
      takenAt: forDate ? `${forDate}T12:00:00` : exifDate(a.exif?.DateTimeOriginal),
      collection,
    })),
  );
}

/** Estado visible de las subidas: lo muestra el aviso flotante en todas las pestañas. */
export type UploadState = {
  phase: "idle" | "preparing" | "uploading" | "done";
  total: number;
  done: number;
  dropped: number;
  left: number;
};
const IDLE: UploadState = { phase: "idle", total: 0, done: 0, dropped: 0, left: 0 };
let state = IDLE;
const subs = new Set<() => void>();
const set = (s: UploadState) => {
  state = s;
  subs.forEach((f) => f());
};
export const getUploadState = () => state;
export const subscribeUploads = (f: () => void) => (subs.add(f), () => void subs.delete(f));
/** Marca que se está preparando lo elegido (se llama nada más volver del selector, antes de que empiece la subida). */
export const markPreparing = () => set({ ...IDLE, phase: "preparing" });
export const dismissUploads = () => set(IDLE);

let flushing = false; // un solo vaciado de la cola a la vez, aunque lo pidan varias pantallas

/** Sube lo pendiente (también lo que quedó de una sesión anterior). `null` si ya había otro vaciado en marcha. */
export async function flushQueue(api: Api, onLeft?: (left: number) => void) {
  if (flushing) return null;
  flushing = true;
  try {
    const total = (await queueStore.load()).length;
    if (total === 0) {
      if (state.phase === "preparing") set(IDLE);
      return { done: 0, dropped: 0, left: 0 };
    }
    set({ phase: "uploading", total, done: 0, dropped: 0, left: total });
    const r = await drain(
      queueStore,
      (p) => api.upload(p),
      (left) => {
        set({ ...state, phase: "uploading", done: total - left, left });
        onLeft?.(left);
      },
    );
    set({ phase: "done", total, done: r.done, dropped: r.dropped, left: r.left });
    return r;
  } finally {
    flushing = false;
  }
}
