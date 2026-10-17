# Roadmap / Pendiente (después de v0.3.0)

Lo que falta por hacer, ordenado por prioridad. Lo ya hecho está en el [`CHANGELOG`](../CHANGELOG.md). / What is left to do, by priority. What is done lives in the [`CHANGELOG`](../CHANGELOG.md).

Legend / Leyenda: **Effort / Esfuerzo** S·M·L

---

## Español

### 1. Antes de anunciar el proyecto
| Qué | Detalle | Esfuerzo |
|---|---|---|
| Probar el QR con un teléfono real | El escáner solo se probó hasta el permiso y la vista de cámara (el emulador no tiene imagen). Falta escanear de verdad el QR del arranque y el de `/pair`. | S |
| ~~Reducir el APK~~ | Hecho en el workflow de release: un APK por arquitectura + universal + checksums. Confirmar en el próximo tag. | S |

### 2. Interfaz (0.3.x) — ver [`ui-review.md`](ui-review.md)
| Qué | Esfuerzo |
|---|---|
| #4 Selector de fecha nativo para mover una foto (hoy es un campo de texto `AAAA-MM-DD`). Requiere un módulo nativo (`@react-native-community/datetimepicker`) y un respaldo en web (`<input type="date">`). | M |
| #12 Iconos propios para las 3 pestañas. | S |
| #7 Estados de carga (esqueletos) y un estado vacío diseñado. | M |
| #8 Logo en el estado vacío y un momento de bienvenida (ya está en Ajustes). | S |
| #9 Movimiento (cambio de mes, abrir un día) con alternativa para "reducir movimiento". | M |
| #11 Mosaico asimétrico en la vista de día. | M |
| #13 Álbumes sin conexión y agrupados por año. | M |
| #10 Vista de dos paneles (calendario + día) en pantallas anchas. | L |
| Fuente Geist para el cuerpo del texto (hoy solo Fraunces en los títulos; el resto usa la del sistema). Exige aplicar la fuente a todos los `Text`/`TextInput` o crear un componente propio. | M |
| Selección múltiple y borrado en bloque; papelera con deshacer (hoy borrar es definitivo). | M |

### 3. Servidor y seguridad
- **Los códigos de emparejamiento viven en memoria**: se pierden al reiniciar (el QR del arranque se vuelve a imprimir). Persistirlos solo si hace falta.
- **Las subidas se cargan enteras en memoria** (el tope `MAX_UPLOAD_MB` protege, pero no es streaming). Subida en trozos o en streaming para videos muy grandes.
- **Despliegue en Cloudflare Workers**: no incluye `/pair` (los códigos en memoria no sirven en Workers) y tiene su propio límite de subida. Allí se conecta escribiendo URL y token.
- **Resumen en video**: sin cola; dos peticiones simultáneas lo generan dos veces (`ponytail:` en `app.ts`).

### 4. Calidad y mantenimiento
- Pruebas de interfaz de extremo a extremo con Playwright en CI (hoy la e2e cubre el servidor real, no la app).
- Una comprobación en CI de que el APK compila (hoy solo se compila en el release).
- Revisar las PRs semanales de Dependabot; las actions (`checkout`, `setup-node`, `pnpm/action-setup`, `gitleaks`) avisan de que Node 20 queda obsoleto. `ubuntu-latest` pasa a Ubuntu 26 el 2026-10-19: vigilar el primer CI después de esa fecha.
- Prueba manual antes de cada release: instalar el APK, emparejar con QR, subir foto y video, mover, borrar, reproducir.

### 5. Distribución (lo hace el dueño del proyecto)
El proyecto es open source y vive en GitHub: **no va a tiendas ni se comercializa**; cada persona levanta su propio servidor y almacenamiento. El APK firmado se publica en GitHub Releases.
- Imagen de vista previa social: subirla a mano en *Settings → Social preview* de GitHub (no tiene API). El archivo está en `assets/brand/social-preview.png`.
- Google Drive: cada quien crea su propio cliente OAuth (modo pruebas = token de 7 días; "en producción" lo evita). Explicarlo bien en `docs/google-drive.md`.
- iOS: no se ha compilado ni probado. Sin tiendas, solo lo usaría quien compile con su propia cuenta de desarrollador; baja prioridad.

### 6. Más adelante
Subidas en segundo plano a nivel del sistema operativo (hoy se retoman al abrir la app) · más idiomas además de es/en · exportar/respaldar todo en un solo archivo · varios usuarios o carpetas compartidas.

---

## English

### 1. Before announcing the project
| What | Detail | Effort |
|---|---|---|
| Test the QR on a real phone | The scanner was only tested up to the permission prompt and the camera view (the emulator has no camera image). Scan the startup QR and the `/pair` QR for real. | S |
| ~~Shrink the APK~~ | Done in the release workflow: one APK per ABI + universal + checksums. Confirm on the next tag. | S |

### 2. UI (0.3.x) — see [`ui-review.md`](ui-review.md)
| What | Effort |
|---|---|
| #4 Native date picker to move a photo (today a raw `YYYY-MM-DD` text field). Needs a native module (`@react-native-community/datetimepicker`) and a web fallback (`<input type="date">`). | M |
| #12 Custom icons for the 3 tabs. | S |
| #7 Loading skeletons and a designed empty state. | M |
| #8 Logo in the empty state and a welcome moment (already in Settings). | S |
| #9 Motion (month change, opening a day) with a reduced-motion fallback. | M |
| #11 Asymmetric masonry in the day view. | M |
| #13 Albums offline and grouped by year. | M |
| #10 Two-pane layout (calendar + day) on wide screens. | L |
| Geist font for body text (today only Fraunces on titles; the rest uses the system font). Needs applying it to every `Text`/`TextInput` or a custom component. | M |
| Multi-select and bulk delete; trash with undo (today deletion is permanent). | M |

### 3. Server and security
- **Pairing codes live in memory**: lost on restart (the startup QR is printed again). Persist only if needed.
- **Uploads are loaded whole into memory** (`MAX_UPLOAD_MB` protects, but it is not streaming). Chunked or streamed upload for very large videos.
- **Cloudflare Workers deployment**: no `/pair` (in-memory codes do not work on Workers) and its own upload limit. Connect there by typing URL and token.
- **Video recap**: no queue; two simultaneous requests generate it twice (`ponytail:` in `app.ts`).

### 4. Quality and maintenance
- End-to-end UI tests with Playwright in CI (today the e2e covers the real server, not the app).
- A CI check that the APK builds (today it only builds on release).
- Review the weekly Dependabot PRs; the actions (`checkout`, `setup-node`, `pnpm/action-setup`, `gitleaks`) warn that Node 20 is deprecated. `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19: watch the first CI run after that date.
- Manual check before each release: install the APK, pair with QR, upload a photo and a video, move, delete, play.

### 5. Distribution (project owner)
The project is open source and lives on GitHub: **no stores, not commercial**; everyone runs their own server and storage. The signed APK ships on GitHub Releases.
- Social preview image: upload it by hand in GitHub *Settings → Social preview* (no API). The file is `assets/brand/social-preview.png`.
- Google Drive: everyone creates their own OAuth client (testing mode = 7-day token; "in production" avoids it). Explain it well in `docs/google-drive.md`.
- iOS: not built or tested. Without stores only someone building with their own developer account would use it; low priority.

### 6. Later
OS-level background uploads (today they resume when the app opens) · more languages besides es/en · export/back up everything in one file · multiple users or shared folders.
