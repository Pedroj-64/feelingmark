import * as ImagePicker from "expo-image-picker";
import type { Api } from "./api";
import { drain, enqueue } from "./queue";
import { queueStore } from "./queue-store";

// "2021:03:04 05:06:07" -> hora local ISO sin zona
const exifDate = (v: unknown) => (typeof v === "string" ? v.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T") : undefined);

/** Abre la galería del sistema (fotos y videos, varios a la vez) y deja lo elegido en la cola. Devuelve cuántos. */
export async function pickAndEnqueue(): Promise<number> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, exif: true });
  if (res.canceled) return 0;
  return enqueue(
    queueStore,
    res.assets.map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType,
      fileName: a.fileName,
      file: a.file,
      takenAt: exifDate(a.exif?.DateTimeOriginal),
    })),
  );
}

let flushing = false; // un solo vaciado de la cola a la vez, aunque lo pidan varias pantallas

/** Sube lo pendiente (también lo que quedó de una sesión anterior). `null` si ya había otro vaciado en marcha. */
export async function flushQueue(api: Api, onLeft?: (left: number) => void) {
  if (flushing) return null;
  flushing = true;
  try {
    return await drain(queueStore, (p) => api.upload(p), onLeft);
  } finally {
    flushing = false;
  }
}
