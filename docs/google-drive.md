# Google Drive storage (experimental) / Almacenamiento en Google Drive (experimental)

## English

Photos live in a **Feelingmark** folder of your own Drive. The server only has the `drive.file` permission: it can see and manage the files it created, nothing else of your Drive. Slower than a local disk or R2, and subject to Drive quotas.

Each person creates their own Google OAuth client; this project ships no credentials.

1. [Google Cloud Console](https://console.cloud.google.com): create a project and enable **Google Drive API**.
2. *Google Auth Platform*: audience **External**, app name `Feelingmark`, scope `.../auth/drive.file`.
   - Leave it in **Testing** and add your own Google account under *Test users* (no logo or domain needed). In Testing the authorization expires every **7 days**; to avoid that you must publish the app, which asks for a verified domain, privacy policy and logo.
3. *Credentials → OAuth client ID → Web application*. Add the redirect URI `http://localhost:8787/oauth/google/callback` (use your port). Download the JSON and keep it private (`chmod 600`).
4. Start the server:
   ```bash
   STORAGE_DRIVER=gdrive GOOGLE_CREDENTIALS_FILE=/path/to/client_secret.json AUTH_TOKEN=... pnpm dev
   ```
   Alternatively use `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. The first time, the log prints an **authorization link**. Open it **on the machine running the server** (Google only accepts `http://localhost` redirects), choose your account and press *Allow*. If Google warns the app is unverified: *Advanced → Go to Feelingmark*.

The refresh token is stored in the server's database. Revoke access any time at https://myaccount.google.com/permissions. Behind HTTPS you can set `GOOGLE_REDIRECT_BASE=https://your-domain` and register that redirect instead.

## Español

Las fotos viven en una carpeta **Feelingmark** de tu propio Drive. El servidor solo tiene el permiso `drive.file`: ve y gestiona los archivos que él creó, nada más de tu Drive. Es más lento que un disco local o R2 y está sujeto a las cuotas de Drive.

Cada persona crea su propio cliente OAuth de Google; este proyecto no incluye credenciales.

1. [Google Cloud Console](https://console.cloud.google.com): crea un proyecto y habilita **Google Drive API**.
2. *Google Auth Platform*: público **Externo**, nombre `Feelingmark`, scope `.../auth/drive.file`.
   - Déjala en **Testing** y añade tu propia cuenta de Google en *Usuarios de prueba* (no hace falta logo ni dominio). En Testing la autorización caduca cada **7 días**; para evitarlo hay que publicar la app, lo que exige dominio verificado, política de privacidad y logo.
3. *Credenciales → ID de cliente de OAuth → Aplicación web*. Añade la URI de redirección `http://localhost:8787/oauth/google/callback` (usa tu puerto). Descarga el JSON y guárdalo en privado (`chmod 600`).
4. Arranca el servidor:
   ```bash
   STORAGE_DRIVER=gdrive GOOGLE_CREDENTIALS_FILE=/ruta/client_secret.json AUTH_TOKEN=... pnpm dev
   ```
   Alternativa: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
5. La primera vez el log imprime un **enlace de autorización**. Ábrelo **en la máquina donde corre el servidor** (Google solo admite redirecciones `http://localhost`), elige tu cuenta y pulsa *Permitir*. Si Google avisa de que la app no está verificada: *Configuración avanzada → Ir a Feelingmark*.

El refresh token se guarda en la base de datos del servidor. Revoca el acceso cuando quieras en https://myaccount.google.com/permissions. Detrás de HTTPS puedes definir `GOOGLE_REDIRECT_BASE=https://tu-dominio` y registrar esa redirección.
