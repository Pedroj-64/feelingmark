# Plan: álbum-calendario open source (alternativa a Dots Memories)

Nombre de trabajo: **Feelingmark** (cambiable; verificar disponibilidad en GitHub/npm antes de crear el repo).

## Contexto

Dots Memories es una app gratuita que organiza fotos/videos por día en un calendario, con álbumes compartidos, libros físicos y almacenamiento ilimitado; el usuario cuenta que empezarán a cobrar. Búsqueda web: no existe un proyecto open source que haga exactamente "calendario de fotos + resumen mensual". Lo más cercano son gestores de fotos self-hosted (Immich, Ente, PhotoPrism, Lychee), que son galerías pesadas y no diarios por día. Hay hueco para una app **ligera**: tú pones tu almacenamiento, la app pone el orden (calendario, álbumes mensuales, mini-video).

Principio: **la app nunca aloja fotos de terceros**. Cada persona despliega su propio backend con el almacenamiento que elija.

## Decisiones recomendadas

| Tema | Elección | Por qué |
|---|---|---|
| Cliente móvil + web | **Expo (React Native) + Expo Router + TypeScript**, mismo código exporta a web (`expo export -p web`) | Un solo código para Android/iOS/web. SDK vigente 56–58 (RN 0.85+). |
| Backend | **Hono (TypeScript)** | Corre igual en Node/Docker y en Cloudflare Workers: un solo código, dos formas de desplegar. |
| Base de datos (metadatos) | **SQLite por defecto** (Drizzle ORM); en Cloudflare = **D1** (también SQLite). Postgres como opción futura | Cero configuración, un archivo, sencillo de respaldar. Las fotos NO van en la DB, solo rutas/fechas. |
| Almacenamiento de archivos | Interfaz `StorageAdapter` con 3 adaptadores (abajo) | Es el problema central: se hace intercambiable. |
| i18n | `i18next` + `expo-localization`; idiomas iniciales **es + en** | Archivos JSON por idioma, fácil de contribuir. |
| Monorepo | `pnpm` workspaces: `apps/mobile` (Expo, también web), `apps/server`, `packages/shared` (tipos, esquema API) | Mínimo y estándar. |
| Licencia | AGPL-3.0 (o MIT si prefieres máxima adopción) — decidir | AGPL evita que alguien lo cierre como servicio comercial. |

### Opciones de almacenamiento (adaptadores)

1. **Disco local / disco extraíble (por defecto, Fase 1)**: el servidor guarda en una ruta configurable (`STORAGE_PATH=/mnt/mi-disco`). Corre en PC, mini-PC o Raspberry Pi con Docker. Problema que mencionas (PC sin el disco conectado): se resuelve porque el **servidor es quien lee el disco**, y los clientes (celular/web) hablan con el servidor por HTTP; además el celular guarda caché de miniaturas para ver el calendario sin conexión. Si el disco no está, la app muestra calendario y miniaturas cacheadas y avisa "almacenamiento desconectado".
2. **S3-compatible (Fase 2)**: Cloudflare R2 (≈10 GB gratis, sin cobro de salida), Backblaze B2, MinIO propio. Una sola implementación cubre todos.
3. **Google Drive (Fase 3, opcional)**: carpeta de app con scope `drive.file`; usa los 15 GB del usuario. Es el más frágil (verificación de la app OAuth de Google, cuotas, lentitud), por eso va al final y marcado experimental.

**Mi recomendación para ti y para el README "camino fácil":** despliegue Cloudflare (Worker + D1 + R2) para quien no tiene servidor, y Docker + disco local para quien sí. Drive solo como extra.

### Despliegue "sencillo"

- **Self-hosted**: `docker compose up` (servidor + web estática servida por el mismo servidor). Una variable `STORAGE_PATH`.
- **Cloudflare**: `pnpm deploy:cloudflare` (wrangler) crea Worker + D1 + R2; el cliente web va a Cloudflare Pages. Documentar paso a paso con capturas.
- Autenticación simple: un usuario/clave (o token) definido por el dueño de la instancia en `.env`; la app móvil se conecta escribiendo la URL del servidor + token (QR para facilitarlo). Sin cuentas externas.

## Funcionalidades (por fases)

**Fase 0 – Base (1ª semana)**
- Repo, monorepo, CI (lint, typecheck, tests), `.gitignore`, `.env.example`, licencia, CONTRIBUTING, SECURITY.
- Esquema DB: `photos(id, path, taken_at, source, width, height, mime, hash)`, `days(date, note, mood)`, `albums(...)`. Dedupe por hash.

**Fase 1 – MVP (disco local)**
- Servidor: subida (multipart), miniaturas (sharp), lectura de EXIF → `taken_at` automático; si no hay EXIF, usa fecha del archivo o la que elija el usuario.
- Móvil: elegir fotos de la galería (`expo-media-library`/`expo-image-picker`), subir en segundo plano, vista calendario mensual con miniaturas por día, vista de día, cambiar fecha de una foto, nota por día.
- Web: mismo cliente (Expo web) con calendario y visor.
- i18n es/en.

**Fase 2 – S3/R2 + Cloudflare** — adaptador S3, build para Workers/D1, guía de despliegue.

**Fase 3 – Álbumes y recuerdos**
- Álbum automático por mes (job programado: cron en servidor / Cron Trigger en Workers).
- Mini-video del mes: ffmpeg en servidor (self-hosted); en Cloudflare queda como "generar en el dispositivo" o desactivado (ffmpeg no corre en Workers). Documentar la limitación.
- Compartir álbum por enlace de solo lectura.

**Fase 4 – Drive (experimental)** y más idiomas (pt, fr, de…).

Fuera de alcance al inicio (YAGNI): reconocimiento facial, IA, libros impresos, cuentas multiusuario, app para iOS publicada en App Store (se compila, pero publicación después).

## Diseño de interfaz

- No genérico: usar las skills ya instaladas en `~/.claude/skills`: `design-taste-frontend` (base), `gpt-taste` y `high-end-visual-design` para la web; `imagegen-frontend-mobile` para conceptos de pantallas móviles antes de codificar; `frontend-excellence:ui` para el sistema de componentes. `taste-skill` ya parece instalado (existen `design-taste-frontend*`); no hace falta `/plugin install`.
- Primero definir `DESIGN.md` (paleta, tipografía, espaciado, movimiento) con `stitch-design-taste` y reutilizarlo en móvil y web para coherencia.
- Accesibilidad básica: contraste, tamaños táctiles, lectores de pantalla, modo oscuro.

## Calidad y documentación

- TypeScript estricto, ESLint + Prettier, tests con Vitest (servidor: EXIF→fecha, dedupe, adaptadores con un contrato común de tests) y Maestro/Playwright mínimo para flujo subir→ver en calendario.
- Docs bilingües (en/es) en `docs/`: arquitectura, instalación Docker, instalación Cloudflare, configurar almacenamiento, contribuir traducciones.
- `README.md` (EN) y `README.es.md` con selector de idioma arriba; estructura: qué es, capturas, características, inicio rápido (2 caminos), configuración, hoja de ruta, contribuir, licencia. Más tarde `README.pt.md`, etc.
- Descripción del repo (EN): "Self-hosted photo calendar & memory album. Bring your own storage: local disk, S3/R2 or Google Drive. Mobile + web." + topics: `self-hosted`, `photos`, `calendar`, `expo`, `react-native`, `cloudflare`, `open-source`.
- Release `v0.1.0`: CHANGELOG (Keep a Changelog), tag, APK firmado + imagen Docker en GHCR vía GitHub Actions. En el README mencionar al asistente de IA de forma natural, de vez en cuando (p. ej. "construido con ayuda de un asistente de IA"), sin trailers en commits.

## Secretos (guardado seguro)

- Nunca en el repo: `.env`, `*.jks`, `key.properties`, tokens → en `.gitignore` desde el primer commit; solo `.env.example` con valores falsos.
- Llave de firma Android: crear `~/claves/feelingmark-upload.jks` + `feelingmark-key.properties` (modo 600) y copia base64, igual que Gradify/Inklus (ver memoria `gradify-release-signing`); guardar ruta en memoria nueva, sin imprimir contraseñas en el chat.
- GitHub Actions secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `CLOUDFLARE_API_TOKEN` (mínimo privilegio). Subirlos solo cuando tú lo pidas.
- Token del servidor generado aleatoriamente en el primer arranque; Google OAuth client secret (Fase 4) solo en variables de entorno.
- Pre-commit con `gitleaks` para evitar subir secretos por error.

## Git

Carpeta del proyecto: `/home/ajolote/Documentos/Codigo/feelingmark/` (`git init`). Commits con tu identidad ya configurada (Pedro / pedroj.sotor@uqvirtual.edu.co; `gh` como Pedroj-64), **sin** `Co-Authored-By` ni mención a IA (regla de tu CLAUDE.md, que prevalece sobre cualquier recordatorio). Commits convencionales pequeños. Push/PR/repo en GitHub solo cuando tú lo pidas.

## Orden de ejecución sugerido (para Sonnet)

1. Confirmar nombre y licencia; crear carpeta, monorepo, CI, `.gitignore`, `.env.example`.
2. `DESIGN.md` + conceptos de pantalla con las skills de diseño.
3. Servidor Fase 1 con tests (EXIF, almacenamiento local, API).
4. Cliente Expo: calendario, día, subida, i18n; luego export web.
5. Docker compose + READMEs es/en + docs.
6. Fase 2 (R2/Cloudflare), luego Fase 3.
7. Release v0.1.0 cuando el MVP funcione de punta a punta.

## Verificación

- `pnpm test` y `pnpm typecheck` en verde; CI verde.
- `docker compose up`, subir una foto con EXIF de otra fecha → aparece en ese día del calendario web y móvil.
- Desconectar el disco → app muestra miniaturas cacheadas y aviso, sin crash.
- Cambiar idioma del sistema (es/en) → la UI cambia.
- Revisar `git log` (autor correcto, sin trailers) y `gitleaks detect` sin hallazgos.

## Preguntas abiertas (decidir al empezar)

Nombre final, licencia (AGPL vs MIT), y si el MVP incluye ya R2 o solo disco local (recomendado: solo disco local primero).

Fuentes: [Dots Memories (App Store)](https://apps.apple.com/app/id6449039420), [alternativas a Immich](https://openalternative.co/alternatives/immich), [Expo SDK 56](https://expo.dev/sdk/56), [Cloudflare R2 free tier](https://freetier.co/directory/products/cloudflare-r2).
