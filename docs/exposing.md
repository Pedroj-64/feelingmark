# Reach your server from outside home / Acceder a tu servidor desde fuera

Feelingmark is self-hosted: nobody runs it for you. The token travels in a header, so over the internet always use HTTPS. Pick **one** option.
Feelingmark es autoalojado: nadie lo corre por ti. El token viaja en una cabecera, así que por internet usa siempre HTTPS. Elige **una** opción.

## 1. Tailscale (easiest, private / la más fácil y privada)
Install [Tailscale](https://tailscale.com) on the server and on the phone, same account. Then:
Instala Tailscale en el servidor y en el teléfono, misma cuenta. Luego:

```sh
tailscale serve --bg 8787      # https://<machine>.<tailnet>.ts.net, only your devices / solo tus dispositivos
```

In the app use that `https://…ts.net` URL. Nothing is public. / En la app usa esa URL. Nada queda público.

## 2. Cloudflare Tunnel (public URL, no open ports / URL pública sin abrir puertos)
```sh
cloudflared tunnel --url http://localhost:8787     # quick test / prueba rápida
```
For a permanent domain follow Cloudflare's [named tunnel guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). Since it is public, keep `AUTH_TOKEN` long and secret (`/pair` is rate-limited).
Para un dominio fijo sigue la guía de túnel con nombre de Cloudflare. Al ser público, mantén `AUTH_TOKEN` largo y secreto (`/pair` limita intentos).

## 3. Reverse proxy (Caddy) / Proxy inverso
```caddy
photos.example.com {
    reverse_proxy localhost:8787
}
```
Caddy gets the certificate by itself; forward ports 80 and 443 on your router. / Caddy obtiene el certificado solo; redirige los puertos 80 y 443 en tu router.

## Checklist
- `AUTH_TOKEN` random and long set it yourself (without it the server makes a temporary one on each start). / defínelo tú (sin él el servidor crea uno temporal en cada arranque).
- `MAX_UPLOAD_MB` set to what your proxy allows (Cloudflare Tunnel free: 100 MB). / según lo que permita tu proxy.
- Test in the app: **Settings → Test connection**. / **Ajustes → Probar conexión**.
