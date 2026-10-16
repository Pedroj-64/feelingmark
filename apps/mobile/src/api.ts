import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import type { Conn } from "./settings.ts";

export type MonthData = { month: string; days: Record<string, number[]>; notes: Record<string, string> };

export function createApi({ url, token }: Conn) {
  const headers = { authorization: `Bearer ${token}` };
  return {
    headers,
    thumbSource: (id: number) => ({ uri: `${url}/photos/${id}/thumb`, headers }),
    fileSource: (id: number) => ({ uri: `${url}/photos/${id}/file`, headers }),
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
    async upload(asset: { uri: string; mimeType?: string; fileName?: string | null; file?: File; takenAt?: string }) {
      const form = new FormData();
      const type = asset.mimeType ?? "image/jpeg";
      if (Platform.OS === "web") form.append("file", asset.file ?? (await (await fetch(asset.uri)).blob()), asset.fileName ?? "photo");
      else form.append("file", { uri: asset.uri, name: asset.fileName ?? "photo.jpg", type } as unknown as Blob);
      // Miniatura hecha en el dispositivo: el servidor (p. ej. Cloudflare Workers) no siempre puede generarla. Si falla, se sube sin ella.
      try {
        const ctx = ImageManipulator.manipulate(asset.uri).resize({ width: 400 });
        const thumb = await (await ctx.renderAsync()).saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 });
        if (Platform.OS === "web") form.append("thumb", await (await fetch(thumb.uri)).blob(), "thumb.jpg");
        else form.append("thumb", { uri: thumb.uri, name: "thumb.jpg", type: "image/jpeg" } as unknown as Blob);
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
