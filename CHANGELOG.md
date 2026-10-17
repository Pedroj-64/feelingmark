# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado semántico.

## [Unreleased]

### Added
- Videos: se pueden subir e importar (mp4, mov, webm, 3gp); fecha desde los metadatos, portada generada con ffmpeg y reproducción con avance libre (Range) en el servidor.
- Reproducción de videos en la app (enlaces firmados de 10 minutos, sin exponer el token); insignia ▶ en el calendario.
- Importador de carpetas (`node src/import.ts <carpeta>`): simula por defecto, informa de dónde sale cada fecha y avisa si todo cae en un solo día; `--apply` guarda y es repetible.
- Guía de uso personal con servidor privado e importación desde el teléfono con `adb`.

### Fixed
- El día del calendario ya no depende de la zona horaria del servidor: se guarda la hora de reloj de la cámara (antes una foto de la noche podía caer en el día siguiente).

### Added
- Accesibilidad: roles y etiquetas para lectores de pantalla (días del calendario, navegación entre meses, campos y botones), encabezados, avisos con región en vivo y los días vacíos ya no se anuncian como botones.

### Changed
- Contraste de colores en modo claro corregido para cumplir WCAG AA (acento `#B65136`, gris secundario `#756E66`); un test vigila el contraste en ambos modos.

## [0.2.0] - 2026-10-16

### Added
- Resumen en video con fundidos entre fotos y música opcional (`VIDEO_MUSIC_FILE`).
- Pestaña Álbumes: un álbum automático por mes con portada y número de fotos; al tocarlo abre ese mes en el calendario.
- Sin conexión: el calendario muestra lo último visto de cada mes (hasta 24) y las miniaturas ya vistas quedan en la caché de disco.

### Fixed
- Cloudflare: `/albums` se atendía como página web en lugar de llegar al Worker; ahora hay un test que vigila las rutas.

## [0.1.2] - 2026-10-16

### Added
- Cola de subidas persistente con reintentos: si falla la red, las fotos quedan pendientes y se suben solas al reabrir la app (verificado en Android con cierre forzado de la app).

## [0.1.1] - 2026-10-16

### Fixed
- Android: subir fotos fallaba con "Unsupported FormDataPart implementation" (el fetch de Expo no admite `{uri}`); ahora funciona.
- La interfaz respeta la barra de estado de Android.
- El botón "Resumen en video" solo aparece si el servidor puede generarlo (no en Cloudflare).
- El aviso de error muestra el motivo.

## [0.1.0] - 2026-10-16

### Added
- Despliegue en Cloudflare (Worker + D1 + R2 + web) con `pnpm deploy:cloudflare`.
- La app sube una miniatura generada en el dispositivo.
- Emparejar el teléfono con un QR impreso por el servidor (con pantalla de confirmación).
- Notas de texto por día, resumen en video del mes (ffmpeg local, sin claves) y enlaces públicos de solo lectura para compartir un mes.
- El núcleo del servidor es asíncrono y no depende de APIs de Node (corre en Node y en Workers).
- Servidor Hono con SQLite: subida de fotos, fecha desde EXIF, duplicados por hash, calendario por mes, mover foto de día, miniaturas webp.
- Almacenamiento intercambiable: disco local, S3-compatible (R2, B2, MinIO) y Google Drive (experimental, solo el scope `drive.file`).
- Cliente Expo (móvil y web): calendario, vista de día, subida desde la galería, ajustes de conexión, es/en, modo oscuro.
- Dockerfile, docker-compose, CI, README en inglés y español.
- Icono de la app, logo animado y demostración en GIF.
- APK de Android firmado, adjunto a cada release.
