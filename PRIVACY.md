# Privacy / Privacidad

## English
Feelingmark is self-hosted software. **The project does not collect, receive or store any of your data**: there is no central server, no analytics and no accounts. Your photos, notes and dates live only where *you* deploy it (your disk, your Cloudflare account, your S3 bucket or your Google Drive).

If you connect Google Drive, the server asks for the `drive.file` permission, which only lets it see and manage the files it creates itself in a "Feelingmark" folder. The authorization token is stored in your own server's database. You can revoke it at any time at https://myaccount.google.com/permissions.

Questions: open an issue at https://github.com/Pedroj-64/feelingmark/issues.

## Español
Feelingmark es software que tú alojas. **El proyecto no recoge, recibe ni guarda ninguno de tus datos**: no hay servidor central, ni analítica, ni cuentas. Tus fotos, notas y fechas viven solo donde *tú* lo despliegues (tu disco, tu cuenta de Cloudflare, tu bucket S3 o tu Google Drive).

Si conectas Google Drive, el servidor pide el permiso `drive.file`, que solo le deja ver y gestionar los archivos que él mismo crea en una carpeta "Feelingmark". El token de autorización se guarda en la base de datos de tu propio servidor. Puedes revocarlo cuando quieras en https://myaccount.google.com/permissions.

Dudas: abre un issue en https://github.com/Pedroj-64/feelingmark/issues.
