import { File, Paths } from "expo-file-system";
import { Appearance, Platform } from "react-native";
import i18n from "./i18n";

/** Preferencias de la app (no son secretos): tema e idioma. "system" = lo que diga el teléfono. */
export type Prefs = { theme: "system" | "light" | "dark"; lang: "system" | "es" | "en" };
export const DEFAULT_PREFS: Prefs = { theme: "system", lang: "system" };
const KEY = "feelingmark.prefs";
const file = () => new File(Paths.document, "feelingmark-prefs.json");

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = Platform.OS === "web" ? localStorage.getItem(KEY) : file().exists ? await file().text() : null;
    return { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(p: Prefs) {
  const raw = JSON.stringify(p);
  if (Platform.OS === "web") return localStorage.setItem(KEY, raw);
  const f = file();
  if (!f.exists) f.create();
  f.write(raw);
}

/** Aplica las preferencias a la app entera: tema nativo e idioma. */
export function applyPrefs(p: Prefs, systemLang: string) {
  try {
    Appearance.setColorScheme?.(p.theme === "system" ? "unspecified" : p.theme); // en web no existe: se queda el del navegador
  } catch {
    /* sin soporte */
  }
  void i18n.changeLanguage(p.lang === "system" ? systemLang : p.lang);
}
