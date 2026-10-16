import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type Conn = { url: string; token: string };
const KEY = "feelingmark.conn";

// SecureStore no existe en web: allí localStorage (ponytail: el token queda en claro en el navegador; aceptable para uso propio).
export async function loadConn(): Promise<Conn | null> {
  const raw = Platform.OS === "web" ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as Conn) : null;
}
export async function saveConn(c: Conn) {
  const raw = JSON.stringify({ url: c.url.replace(/\/+$/, ""), token: c.token });
  if (Platform.OS === "web") localStorage.setItem(KEY, raw);
  else await SecureStore.setItemAsync(KEY, raw);
}
