/** Ayudas puras para importar de la galería del teléfono (sin dependencias nativas, para poder probarlas). */

/** Hora de reloj local ISO sin zona, como la espera el servidor ("2021-03-04T05:06:07"). */
export const wallClock = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
};

/** Tipo MIME por extensión; null si el servidor no lo aceptaría (gif, raw, audio…). */
export const mimeFromName = (name: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? null;

/** Solo lo posterior a la última importación del álbum (marca = creationTime en ms del más reciente ya importado). */
export const isNew = (creationTime: number | null, mark: number) => creationTime == null || creationTime > mark;

/**
 * El multipart se arma en memoria (FormData de Expo), así que un video enorme tumbaría la app:
 * por encima de este tope se omite y se avisa. ponytail: subida en streaming si hace falta más.
 */
export const MAX_VIDEO_MB = 200;
