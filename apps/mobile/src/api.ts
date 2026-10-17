import { File as FsFile } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";
import { MAX_VIDEO_MB } from "./gallery.ts";
import type { Conn } from "./settings.ts";

/** Archivo local para FormData en nativo: el fetch de Expo no admite {uri,...}; pide un objeto con bytes(), name y type. */
const nativePart = (uri: string, name: string, type: string) => ({ name, type, bytes: () => new FsFile(uri).bytes() }) as unknown as Blob;

export type Album = { month: string; count: number; cover: number };

export type Stats = { photos: number; videos: number; notes: number; first: string | null; last: string | null };
export type Memory = { date: string; ids: number[]; videos: number[]; note?: string };
export type SearchHit = { date: string; note: string; cover: number | null };

export type TimelineItem = { id: number; takenAt: string; video: boolean };

export type MonthData = {
  month: string;
  days: Record<string, number[]>;
  notes: Record<string, string>;
  videos?: number[];
  video?: boolean;
};

export function createApi({ url, token }: Conn) {
  const headers = { authorization: `Bearer ${token}` };
  return {
    headers,
    thumbSource: (id: number) => ({ uri: `${url}/photos/${id}/thumb`, headers, cacheKey: `${url}#thumb${id}` }),
    fileSource: (id: number) => ({ uri: `${url}/photos/${id}/file`, headers, cacheKey: `${url}#file${id}` }),
    async month(ym: string): Promise<MonthData> {
      const r = await fetch(`${url}/photos?month=${ym}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    /** URL pública de solo lectura del mes (se crea la primera vez). */
    async share(month: string): Promise<string> {
      const r = await fetch(`${url}/albums/${month}/share`, { method: "POST", headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return `${url}${(await r.json()).path}`;
    },
    async albums(): Promise<Album[]> {
      const r = await fetch(`${url}/albums`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).albums;
    },
    /** URL firmada y de corta duración para reproducir un video (el reproductor no puede mandar cabeceras). */
    async videoUrl(id: number): Promise<string> {
      const r = await fetch(`${url}/photos/${id}/link`, { method: "POST", headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return `${url}${(await r.json()).path}`;
    },
    /** Toda la biblioteca, lo más reciente primero, por páginas. `next` es el cursor de la página siguiente (null = no hay más). */
    async timeline(cursor?: string | null): Promise<{ items: TimelineItem[]; next: string | null }> {
      const r = await fetch(`${url}/timeline?limit=90${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async stats(): Promise<Stats> {
      const r = await fetch(`${url}/stats`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    /** "Un día como hoy": lo de ese día y mes en años anteriores. */
    async memories(date: string): Promise<Memory[]> {
      const r = await fetch(`${url}/memories?date=${date}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).memories;
    },
    async search(q: string): Promise<SearchHit[]> {
      const r = await fetch(`${url}/search?q=${encodeURIComponent(q)}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).results;
    },
    /** Video del resumen del mes, por el enlace público de solo lectura (el reproductor no puede mandar cabeceras). */
    async recapUrl(month: string): Promise<string> {
      return `${await this.share(month)}/video`;
    },
    async saveNote(date: string, note: string) {
      const r = await fetch(`${url}/days/${date}`, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    async move(id: number, date: string) {
      const r = await fetch(`${url}/photos/${id}`, {
        method: "PATCH",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ takenAt: date }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    /** Devuelve cuántos archivos no se pudieron quitar del almacenamiento (el registro sí se borró). */
    async remove(id: number): Promise<number> {
      const r = await fetch(`${url}/photos/${id}`, { method: "DELETE", headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json().catch(() => ({}))) as { orphaned?: number };
      return typeof body.orphaned === "number" ? body.orphaned : 0;
    },
    async upload(asset: { uri: string; mimeType?: string; fileName?: string | null; file?: File; takenAt?: string }) {
      const form = new FormData();
      const type = asset.mimeType ?? "image/jpeg";
      if (Platform.OS === "web") form.append("file", asset.file ?? (await (await fetch(asset.uri)).blob()), asset.fileName ?? "photo");
      else {
        // El multipart se arma en memoria: un video enorme tumbaría la app. Se rechaza (la cola lo cuenta como no subido).
        if (type.startsWith("video/") && (new FsFile(asset.uri).size ?? 0) > MAX_VIDEO_MB * 1024 * 1024) throw new Error("video too large");
        form.append("file", nativePart(asset.uri, asset.fileName ?? "photo.jpg", type));
      }
      // Miniatura hecha en el dispositivo: el servidor (p. ej. Cloudflare Workers) no siempre puede generarla. Si falla, se sube sin ella.
      try {
        const ctx = ImageManipulator.manipulate(asset.uri).resize({ width: 400 });
        const thumb = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
        if (Platform.OS === "web") form.append("thumb", await (await fetch(thumb.uri)).blob(), "thumb.jpg");
        else form.append("thumb", nativePart(thumb.uri, "thumb.jpg", "image/jpeg"));
      } catch {
        /* sin miniatura */
      }
      if (asset.takenAt) form.append("takenAt", asset.takenAt);
      const r = await fetch(`${url}/photos`, { method: "POST", body: form, headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ id: number; takenAt: string; duplicate: boolean }>;
    },
  };
}
export type Api = ReturnType<typeof createApi>;
