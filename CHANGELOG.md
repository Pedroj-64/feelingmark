# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado semántico.

## [Unreleased]

### Added
- Despliegue en Cloudflare (Worker + D1 + R2 + web) con `pnpm deploy:cloudflare`.
- La app sube una miniatura generada en el dispositivo.

### Changed
- El núcleo del servidor es asíncrono y no depende de APIs de Node; la base de v0.1.0 se migra sola.

## [0.1.0] - 2026-10-16

### Added
- Servidor Hono con SQLite: subida de fotos, fecha desde EXIF, duplicados por hash, calendario por mes, mover foto de día, miniaturas webp.
- Almacenamiento intercambiable: disco local y S3-compatible (R2, B2, MinIO).
- Cliente Expo (móvil y web): calendario, vista de día, subida desde la galería, ajustes de conexión, es/en, modo oscuro.
- Dockerfile, docker-compose, CI, README en inglés y español.
- Icono de la app, logo animado y demostración en GIF.
- APK de Android firmado, adjunto a cada release.
