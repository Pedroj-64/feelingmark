# Install / Instalación

## English

### 1. Server with Docker (recommended)
```bash
git clone https://github.com/Pedroj-64/feelingmark && cd feelingmark
echo "AUTH_TOKEN=$(openssl rand -hex 24)" > .env
echo "DATA_DIR=/path/to/your/disk/feelingmark" >> .env   # optional, default ./data
docker compose up -d
```
This pulls the published image `ghcr.io/pedroj-64/feelingmark` (use `docker compose up -d --build` to build it from source). The server and the web client are on `http://<your-machine>:8787`. Keep `.env` private: the token gives full access.

Without Docker: Node 26+, `pnpm install`, then `cd apps/server && AUTH_TOKEN=... pnpm dev` (set `WEB_DIR` to an `expo export -p web` folder to serve the web client; the video recap needs `ffmpeg` on the PATH).

### 2. Connect the app
Open the web client or the Android app → **Settings** → enter the server URL and the token. On a phone use your machine's LAN address (`http://192.168.x.x:8787`). Over the internet put the server behind HTTPS (Caddy, nginx, Cloudflare Tunnel, Tailscale — see [exposing.md](exposing.md)): the token travels in a header.

**Pair with a QR:** open the app and tap **Scan QR**. The server prints a QR when it starts (`docker compose logs feelingmark` in Docker), and you can show a new one any time at `http://<your-machine>:8787/pair` (type your `AUTH_TOKEN` there). The QR holds a one-time code that expires in 15 minutes, never your token. `/pair` uses the address you opened it with, so it works in Docker as is; for the QR printed in the logs set `PUBLIC_URL=http://<your-LAN-ip>:8787`.

### 3. Android app
Feelingmark is not on any app store; install the signed APK from [Releases](https://github.com/Pedroj-64/feelingmark/releases):

| File | For |
|---|---|
| `…-arm64-v8a.apk` (~40 MB) | nearly every phone from 2017 on |
| `…-armeabi-v7a.apk` (~40 MB) | old or very cheap 32-bit phones |
| `…-x86_64.apk` (~40 MB) | emulators and some Chromebooks |
| `…-universal.apk` (~122 MB) | not sure? this works everywhere |

1. Open the downloaded file. Android will ask to allow installs from your browser or file manager ("unknown sources"): allow it only for that app. It is needed because the app is not distributed through a store.
2. Optional check: `sha256sum -c SHA256SUMS.txt --ignore-missing` against the checksums file of the same release.
3. To update, install the new APK over the old one (same signing key, your data stays). [Obtainium](https://obtainium.imranr.dev) can notify you of new releases from GitHub.

To build it yourself: `cd apps/mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease` (JDK 21 + Android SDK).

### Video recap
The monthly video needs **no API key, account or paid service**: the server builds it locally with `ffmpeg` (a photo slideshow, 3 s per photo with soft cross-fades). **Optional music:** set `VIDEO_MUSIC_FILE=/path/to/audio.mp3` (use audio you have the rights to; it loops and fades out at the end). The Docker image already includes ffmpeg; without Docker install it (`apt install ffmpeg`, `brew install ffmpeg`, `pacman -S ffmpeg`). If it is missing, the endpoint answers `501`. Not available on a Cloudflare Workers deployment.

### Removable drive
Mount it and point `DATA_DIR` (Docker) or `STORAGE_PATH` at it. If the drive is unplugged the server answers `503` for photos and the app keeps working with what it has cached; plug it back in and everything returns.

## Español

### 1. Servidor con Docker (recomendado)
```bash
git clone https://github.com/Pedroj-64/feelingmark && cd feelingmark
echo "AUTH_TOKEN=$(openssl rand -hex 24)" > .env
echo "DATA_DIR=/ruta/a/tu/disco/feelingmark" >> .env   # opcional, por defecto ./data
docker compose up -d
```
Esto descarga la imagen publicada `ghcr.io/pedroj-64/feelingmark` (usa `docker compose up -d --build` para compilarla desde el código). El servidor y el cliente web quedan en `http://<tu-equipo>:8787`. Mantén `.env` privado: el token da acceso total.

Sin Docker: Node 26+, `pnpm install` y `cd apps/server && AUTH_TOKEN=... pnpm dev` (define `WEB_DIR` con una carpeta de `expo export -p web` para servir la web; el resumen en video necesita `ffmpeg` en el PATH).

### 2. Conectar la app
Abre el cliente web o la app Android → **Ajustes** → escribe la URL del servidor y el token. En el celular usa la dirección de tu equipo en la red local (`http://192.168.x.x:8787`). Por internet pon el servidor detrás de HTTPS (Caddy, nginx, Cloudflare Tunnel, Tailscale — ver [exposing.md](exposing.md)): el token viaja en una cabecera.

**Emparejar con QR:** abre la app y toca **Escanear QR**. El servidor imprime un QR al arrancar (`docker compose logs feelingmark` en Docker) y puedes mostrar uno nuevo cuando quieras en `http://<tu-equipo>:8787/pair` (escribe allí tu `AUTH_TOKEN`). El QR lleva un código de un solo uso que caduca a los 15 minutos, nunca tu token. `/pair` usa la dirección con la que lo abres, así que funciona en Docker sin más; para el QR de los logs define `PUBLIC_URL=http://<ip-de-tu-red>:8787`.

### 3. App Android
Feelingmark no está en ninguna tienda; instala el APK firmado desde [Releases](https://github.com/Pedroj-64/feelingmark/releases):

| Archivo | Para |
|---|---|
| `…-arm64-v8a.apk` (~40 MB) | casi cualquier teléfono desde 2017 |
| `…-armeabi-v7a.apk` (~40 MB) | teléfonos viejos o muy baratos de 32 bits |
| `…-x86_64.apk` (~40 MB) | emuladores y algunos Chromebooks |
| `…-universal.apk` (~122 MB) | ¿no sabes cuál? este sirve en todos |

1. Abre el archivo descargado. Android pedirá permitir instalar desde tu navegador o gestor de archivos («orígenes desconocidos»): permítelo solo para esa app. Hace falta porque la app no se distribuye por una tienda.
2. Verificación opcional: `sha256sum -c SHA256SUMS.txt --ignore-missing` con el archivo de sumas del mismo release.
3. Para actualizar, instala el APK nuevo encima del anterior (misma firma, tus datos se conservan). [Obtainium](https://obtainium.imranr.dev) puede avisarte de nuevos releases en GitHub.

Para compilarlo tú: `cd apps/mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease` (JDK 21 + Android SDK).

### Resumen en video
El video mensual **no necesita ninguna API key, cuenta ni servicio de pago**: el servidor lo genera localmente con `ffmpeg` (presentación de fotos, 3 s por foto con fundidos suaves). **Música opcional:** define `VIDEO_MUSIC_FILE=/ruta/a/audio.mp3` (usa un audio del que tengas derechos; se repite y se apaga al final). La imagen Docker ya incluye ffmpeg; sin Docker instálalo (`apt install ffmpeg`, `brew install ffmpeg`, `pacman -S ffmpeg`). Si falta, el endpoint responde `501`. No está disponible en un despliegue de Cloudflare Workers.

### Disco extraíble
Móntalo y apunta `DATA_DIR` (Docker) o `STORAGE_PATH` a él. Si lo desconectas, el servidor responde `503` para las fotos y la app sigue con lo que tiene en caché; al reconectarlo todo vuelve.
