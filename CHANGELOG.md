# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado semántico.

## [Unreleased]

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
