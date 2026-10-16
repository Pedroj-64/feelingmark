<p align="right"><a href="README.md">English</a> · <b>Español</b></p>

# Feelingmark

**Un álbum-calendario de fotos y recuerdos que tú alojas.** Pones tu almacenamiento; Feelingmark pone el orden: un calendario, un día a la vez.

Nace como alternativa abierta para quienes usaban apps como Dots Memories y no quieren que sus recuerdos queden atados a la suscripción de otro. La app móvil (Android/iOS) y el cliente web comparten el mismo código.

> Estado: desarrollo temprano (pre-0.1). Lo esencial funciona; espera aristas por pulir.

## Características

- Vista de calendario: cada día muestra sus fotos; toca un día para abrirlo.
- La fecha de la foto se lee del EXIF; si no existe, de la fecha del archivo, y siempre puedes moverla a otro día.
- Las fotos duplicadas se detectan y se omiten.
- Tu almacenamiento, tus reglas: los archivos viven en el disco que elijas (sirve un disco extraíble). La app no aloja nada por ti.
- Miniaturas generadas por tu servidor; la app móvil habla con él por HTTP con un token privado.
- Modo claro/oscuro, español e inglés (se aceptan más idiomas).

Planeado: almacenamiento S3/R2, despliegue en Cloudflare, álbumes mensuales y mini-videos, enlaces para compartir, Google Drive (experimental). Ver [`docs/PLAN.md`](docs/PLAN.md).

## Inicio rápido (Docker)

```bash
git clone <este repo> && cd feelingmark
echo "AUTH_TOKEN=$(openssl rand -hex 24)" > .env
echo "DATA_DIR=/ruta/a/tu/disco/feelingmark" >> .env   # opcional, por defecto ./data
docker compose up -d --build
```

Abre `http://localhost:8787` para el cliente web. En **Ajustes**, escribe la URL del servidor y tu token. La app móvil se conecta igual (usa la dirección de tu computador en la red local, p. ej. `http://192.168.1.10:8787`).

## Desarrollo

Requiere Node 26+ y pnpm.

```bash
pnpm install
pnpm test && pnpm typecheck
cd apps/server && AUTH_TOKEN=dev pnpm dev          # API en :8787
cd apps/mobile && pnpm web                         # o: pnpm android
```

La configuración va en variables de entorno; mira [`.env.example`](.env.example). Nunca subas tu `.env`.

## Estructura

- `apps/server` — API con Hono, SQLite (`node:sqlite` integrado), adaptadores de almacenamiento.
- `apps/mobile` — app Expo (React Native), también exportada como cliente web.
- `DESIGN.md` — sistema de diseño visual.

## Contribuir

Issues y PRs son bienvenidos. Para añadir un idioma, copia `apps/mobile/src/i18n/en.ts` a `xx.ts` y regístralo en `i18n/index.ts`.

Partes de este proyecto se construyeron con ayuda de un asistente de IA.

## Licencia

[AGPL-3.0](LICENSE)
