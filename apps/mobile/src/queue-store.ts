import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type { Pending, QueueStore } from "./queue.ts";

// En web las fotos son objetos File que no se pueden serializar: la cola vive solo mientras la pestaña esté abierta.
let memory: Pending[] = [];
const webStore: QueueStore = { load: async () => memory, save: async (items) => void (memory = items) };

function nativeStore(): QueueStore {
  const file = new File(Paths.document, "feelingmark-upload-queue.json");
  return {
    async load() {
      try {
        return file.exists ? (JSON.parse(await file.text()) as Pending[]) : [];
      } catch {
        return []; // archivo corrupto: se empieza de cero
      }
    },
    async save(items) {
      if (!file.exists) file.create();
      file.write(JSON.stringify(items));
    },
  };
}

export const queueStore: QueueStore = Platform.OS === "web" ? webStore : nativeStore();
