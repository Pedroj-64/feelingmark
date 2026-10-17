/** Lo que lleva el QR de emparejamiento: feelingmark://connect?u=<servidor>&c=<código de un solo uso> (o &t=<token>, formato antiguo). */
export type Pairing = { url: string; code?: string; token?: string };

export function parsePairing(raw: string): Pairing | null {
  // QR actual: enlace web <servidor>/pair/go?c=<código> (lo lee cualquier cámara); se admite también dentro de la app.
  const web = /^(https?:\/\/[^\s/?#]+)\/pair\/go\?c=([0-9a-f]{16,64})$/i.exec(raw.trim());
  if (web) return { url: web[1], code: web[2] };
  const m = /^feelingmark:\/\/connect\?(.+)$/.exec(raw.trim());
  if (!m) return null;
  const p: Record<string, string> = {};
  for (const pair of m[1].split("&")) {
    const [k, v = ""] = pair.split("=");
    try {
      p[k] = decodeURIComponent(v);
    } catch {
      return null;
    }
  }
  if (!p.u || !/^https?:\/\/[^\s/]+/i.test(p.u) || !(p.c || p.t)) return null;
  return { url: p.u.replace(/\/+$/, ""), code: p.c || undefined, token: p.t || undefined };
}

/** Cambia el código de un solo uso por el token. Falla si el código ya se usó, caducó o el servidor no responde. */
export async function redeem(url: string, code: string, fetcher: typeof fetch = fetch): Promise<string> {
  const r = await fetcher(`${url}/pair/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const { token } = (await r.json()) as { token?: unknown };
  if (typeof token !== "string" || !token) throw new Error("no token");
  return token;
}
