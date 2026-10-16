# Storage / Almacenamiento

**EN** — Photos and generated files (thumbnails, video recaps) go through a `StorageAdapter` (`put` / `get`). Metadata (dates, notes, share links) always lives in a small SQLite file (`DATABASE_PATH`), so back up both.

| Driver | How | Notes |
|---|---|---|
| `local` (default) | `STORAGE_PATH=/mnt/disk/photos` | Any disk, including removable. |
| `s3` | `STORAGE_DRIVER=s3` + `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Cloudflare R2 (generous free tier, no egress fees), Backblaze B2, MinIO, AWS. |
| `gdrive` (experimental) | `STORAGE_DRIVER=gdrive` + Google OAuth client | Your own Drive, `drive.file` scope only. See [google-drive.md](google-drive.md). |

Cloudflare R2 example: create a bucket and an API token with *Object Read & Write*; endpoint is `https://<account-id>.r2.cloudflarestorage.com`, region `auto`.

**ES** — Las fotos y los archivos generados (miniaturas, resúmenes en video) pasan por un `StorageAdapter` (`put` / `get`). Los metadatos (fechas, notas, enlaces compartidos) viven siempre en un SQLite pequeño (`DATABASE_PATH`): respalda ambos.

| Driver | Cómo | Notas |
|---|---|---|
| `local` (por defecto) | `STORAGE_PATH=/mnt/disco/fotos` | Cualquier disco, también extraíble. |
| `s3` | `STORAGE_DRIVER=s3` + `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | Cloudflare R2 (capa gratis generosa, sin cobro de salida), Backblaze B2, MinIO, AWS. |
| `gdrive` (experimental) | `STORAGE_DRIVER=gdrive` + cliente OAuth de Google | Tu propio Drive, solo el scope `drive.file`. Ver [google-drive.md](google-drive.md). |

Ejemplo con R2: crea un bucket y un token de API con *Object Read & Write*; el endpoint es `https://<id-de-cuenta>.r2.cloudflarestorage.com` y la región `auto`.
