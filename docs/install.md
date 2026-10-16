# Install / Instalación

## English

### 1. Server with Docker (recommended)
```bash
git clone https://github.com/Pedroj-64/feelingmark && cd feelingmark
echo "AUTH_TOKEN=$(openssl rand -hex 24)" > .env
echo "DATA_DIR=/path/to/your/disk/feelingmark" >> .env   # optional, default ./data
docker compose up -d --build
```
The server and the web client are on `http://<your-machine>:8787`. Keep `.env` private: the token gives full access.

Without Docker: Node 26+, `pnpm install`, then `cd apps/server && AUTH_TOKEN=... pnpm dev` (set `WEB_DIR` to an `expo export -p web` folder to serve the web client; the video recap needs `ffmpeg` on the PATH).

### 2. Connect the app
Open the web client or the Android app → **Settings** → enter the server URL and the token. On a phone use your machine's LAN address (`http://192.168.x.x:8787`). Over the internet put the server behind HTTPS (Caddy, nginx, Cloudflare Tunnel): the token travels in a header.

### 3. Android app
Download the signed APK from the [Releases](https://github.com/Pedroj-64/feelingmark/releases) page, or build it: `cd apps/mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease` (JDK 21 + Android SDK).

### Video recap
The monthly video needs **no API key, account or paid service**: the server builds it locally with `ffmpeg` (a photo slideshow, 2 s per photo, no music). The Docker image already includes ffmpeg; without Docker install it (`apt install ffmpeg`, `brew install ffmpeg`, `pacman -S ffmpeg`). If it is missing, the endpoint answers `501`. Not available on a Cloudflare Workers deployment.

### Removable drive
Mount it and point `DATA_DIR` (Docker) or `STORAGE_PATH` at it. If the drive is unplugged the server answers `503` for photos and the app keeps working with what it has cached; plug it back in and everything returns.

## Español

### 1. Servidor con Docker (recomendado)
```bash
git clone https://github.com/Pedroj-64/feelingmark && cd feelingmark
echo "AUTH_TOKEN=$(openssl rand -hex 24)" > .env
echo "DATA_DIR=/ruta/a/tu/disco/feelingmark" >> .env   # opcional, por defecto ./data
docker compose up -d --build
```
El servidor y el cliente web quedan en `http://<tu-equipo>:8787`. Mantén `.env` privado: el token da acceso total.

Sin Docker: Node 26+, `pnpm install` y `cd apps/server && AUTH_TOKEN=... pnpm dev` (define `WEB_DIR` con una carpeta de `expo export -p web` para servir la web; el resumen en video necesita `ffmpeg` en el PATH).

### 2. Conectar la app
Abre el cliente web o la app Android → **Ajustes** → escribe la URL del servidor y el token. En el celular usa la dirección de tu equipo en la red local (`http://192.168.x.x:8787`). Por internet pon el servidor detrás de HTTPS (Caddy, nginx, Cloudflare Tunnel): el token viaja en una cabecera.

### 3. App Android
Descarga el APK firmado desde [Releases](https://github.com/Pedroj-64/feelingmark/releases), o compílalo: `cd apps/mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease` (JDK 21 + Android SDK).

### Resumen en video
El video mensual **no necesita ninguna API key, cuenta ni servicio de pago**: el servidor lo genera localmente con `ffmpeg` (presentación de fotos, 2 s por foto, sin música). La imagen Docker ya incluye ffmpeg; sin Docker instálalo (`apt install ffmpeg`, `brew install ffmpeg`, `pacman -S ffmpeg`). Si falta, el endpoint responde `501`. No está disponible en un despliegue de Cloudflare Workers.

### Disco extraíble
Móntalo y apunta `DATA_DIR` (Docker) o `STORAGE_PATH` a él. Si lo desconectas, el servidor responde `503` para las fotos y la app sigue con lo que tiene en caché; al reconectarlo todo vuelve.
