import { Platform } from "react-native";
import type { Conn } from "./settings.ts";

export type MonthData = { month: string; days: Record<string, number[]> };

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
    async move(id: number, date: string) {
      const r = await fetch(`${url}/photos/${id}`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ takenAt: date }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    async upload(asset: { uri: string; mimeType?: string; fileName?: string | null; file?: File; takenAt?: string }) {
      const form = new FormData();
      const type = asset.mimeType ?? "image/jpeg";
      if (Platform.OS === "web") form.append("file", asset.file ?? (await (await fetch(asset.uri)).blob()), asset.fileName ?? "photo");
      else form.append("file", { uri: asset.uri, name: asset.fileName ?? "photo.jpg", type } as unknown as Blob);
      if (asset.takenAt) form.append("takenAt", asset.takenAt);
      const r = await fetch(`${url}/photos`, { method: "POST", body: form, headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ id: number; takenAt: string; duplicate: boolean }>;
    },
  };
}
export type Api = ReturnType<typeof createApi>;
