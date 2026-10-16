# Security / Seguridad

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab) instead of a public issue. / Reporta las vulnerabilidades en privado desde la pestaña Security de GitHub, no en un issue público.

Notes for operators / Notas para quien aloja el servidor:
- Set a long random `AUTH_TOKEN`; anyone with it can read and upload photos. / Define un `AUTH_TOKEN` largo y aleatorio: quien lo tenga puede ver y subir fotos.
- Serve the server over HTTPS (reverse proxy or Cloudflare) when it is reachable from the internet; on plain HTTP the token travels unencrypted. / Sirve el servidor por HTTPS si es accesible desde internet; por HTTP el token viaja sin cifrar.
- Never commit `.env`, keystores or tokens. / Nunca subas `.env`, keystores ni tokens.
