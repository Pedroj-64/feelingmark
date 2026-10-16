import type en from "./en.ts";

const es: typeof en = {
  tabs: { calendar: "Calendario", settings: "Ajustes" },
  calendar: { add: "Añadir fotos", empty: "Aún no hay nada. Añade la primera foto de este mes.", uploading: "Subiendo…", uploaded_one: "{{count}} foto añadida", uploaded_other: "{{count}} fotos añadidas", offline: "Almacenamiento no disponible. Mostrando lo guardado." },
  settings: { title: "Conecta tu servidor", url: "URL del servidor", token: "Token de acceso", save: "Guardar", saved: "Guardado", hint: "Feelingmark no guarda nada por ti: apúntalo a tu propio servidor." },
  common: { error: "Algo salió mal. Inténtalo de nuevo." },
};
export default es;
