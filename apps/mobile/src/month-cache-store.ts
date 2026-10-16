import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { createMonthCache, type BlobStore } from "./month-cache.ts";

const KEY = "feelingmark.months";

const webStore: BlobStore = {
  load: async () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  save: async (raw) => {
    try {
      localStorage.setItem(KEY, raw);
    } catch {
      /* sin espacio o bloqueado: simplemente no se cachea */
    }
  },
};

function nativeStore(): BlobStore {
  const file = new File(Paths.document, "feelingmark-months.json");
  return {
    load: async () => (file.exists ? await file.text() : null),
    save: async (raw) => {
      if (!file.exists) file.create();
      file.write(raw);
    },
  };
}

export const monthCache = createMonthCache(Platform.OS === "web" ? webStore : nativeStore());
