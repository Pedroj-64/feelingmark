import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.ts";
import es from "./es.ts";

// Para añadir un idioma: crea xx.ts con el tipo de en.ts y regístralo aquí.
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: getLocales()[0]?.languageCode ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});
export default i18n;
