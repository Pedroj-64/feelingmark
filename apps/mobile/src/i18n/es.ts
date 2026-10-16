import type en from "./en.ts";

const es: typeof en = {
  tabs: { calendar: "Calendario", settings: "Ajustes" },
  calendar: {
    video: "Resumen en video",
    share: "Compartir mes",
    linkCopied: "Enlace copiado",
    add: "Añadir fotos",
    empty: "Aún no hay nada. Añade la primera foto de este mes.",
    uploading: "Subiendo…",
    uploaded_one: "{{count}} foto añadida",
    uploaded_other: "{{count}} fotos añadidas",
    offline: "Almacenamiento no disponible. Mostrando lo guardado.",
  },
  connect: {
    title: "Conectar con tu servidor",
    confirm: "Conéctate solo si escaneaste este código de tu propio servidor:",
    action: "Conectar",
    cancel: "Cancelar",
    invalid: "Este código de emparejamiento no es válido.",
  },
  day: { notePlaceholder: "Escribe algo sobre este día…", move: "Mover al día", moved: "Movida", invalid: "Usa el formato AAAA-MM-DD" },
  settings: {
    title: "Conecta tu servidor",
    url: "URL del servidor",
    token: "Token de acceso",
    save: "Guardar",
    saved: "Guardado",
    hint: "Feelingmark no guarda nada por ti: apúntalo a tu propio servidor.",
  },
  common: { error: "Algo salió mal. Inténtalo de nuevo." },
};
export default es;
