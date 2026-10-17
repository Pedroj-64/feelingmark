# Security / Seguridad

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab) instead of a public issue. / Reporta las vulnerabilidades en privado desde la pestaña Security de GitHub, no en un issue público.

Notes for operators / Notas para quien aloja el servidor:
- Set a long random `AUTH_TOKEN`; anyone with it can read and upload photos. / Define un `AUTH_TOKEN` largo y aleatorio: quien lo tenga puede ver y subir fotos.
- Serve the server over HTTPS (reverse proxy or Cloudflare) when it is reachable from the internet; on plain HTTP the token travels unencrypted. / Sirve el servidor por HTTPS si es accesible desde internet; por HTTP el token viaja sin cifrar.
- Video playback uses signed links valid for 10 minutes and only for that file; they do not reveal the token. / La reproducción de video usa enlaces firmados de 10 minutos, válidos solo para ese archivo; no revelan el token.
- Never commit `.env`, keystores or tokens. / Nunca subas `.env`, keystores ni tokens.
- The pairing QR holds a one-time code that expires after 15 minutes, not the token, but treat it as sensitive until used. The `AUTH_TOKEN` itself gives full access: never share it, and use HTTPS when the server is reachable from the Internet. / El QR de emparejamiento lleva un código de un solo uso que caduca a los 15 minutos, no el token, pero trátalo como sensible hasta usarlo. El `AUTH_TOKEN` da acceso total: no lo compartas y usa HTTPS si el servidor es accesible desde Internet.
