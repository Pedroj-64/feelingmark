# Security / Seguridad

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab) instead of a public issue. / Reporta las vulnerabilidades en privado desde la pestaña Security de GitHub, no en un issue público.

Notes for operators / Notas para quien aloja el servidor:
- Set a long random `AUTH_TOKEN`; anyone with it can read and upload photos. / Define un `AUTH_TOKEN` largo y aleatorio: quien lo tenga puede ver y subir fotos.
- Serve the server over HTTPS (reverse proxy or Cloudflare) when it is reachable from the internet; on plain HTTP the token travels unencrypted. / Sirve el servidor por HTTPS si es accesible desde internet; por HTTP el token viaja sin cifrar.
- Video playback uses signed links valid for 10 minutes and only for that file; they do not reveal the token. / La reproducción de video usa enlaces firmados de 10 minutos, válidos solo para ese archivo; no revelan el token.
- Never commit `.env`, keystores or tokens. / Nunca subas `.env`, keystores ni tokens.
- The pairing QR printed at startup contains the token: do not share logs/screenshots of it. / El QR de emparejamiento que se imprime al arrancar contiene el token: no compartas logs ni capturas.
