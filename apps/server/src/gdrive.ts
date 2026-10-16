import type { StorageAdapter } from "./storage.ts";

const GOOGLE = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  api: "https://www.googleapis.com/drive/v3",
  upload: "https://www.googleapis.com/upload/drive/v3",
};
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"; // solo archivos creados por la app

export type GoogleCreds = { clientId: string; clientSecret: string };
type Endpoints = Partial<typeof GOOGLE>;

/** URL de consentimiento. access_type=offline + prompt=consent garantizan un refresh token. */
export function authUrl(c: GoogleCreds, redirectUri: string, state: string, e: Endpoints = {}) {
  const q = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${e.auth ?? GOOGLE.auth}?${q}`;
}

export async function exchangeCode(c: GoogleCreds, redirectUri: string, code: string, e: Endpoints = {}): Promise<string> {
  const r = await fetch(e.token ?? GOOGLE.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { refresh_token?: string; error?: string };
  if (!r.ok || !j.refresh_token) throw new Error(`google token exchange failed: ${j.error ?? r.status}`);
  return j.refresh_token;
}

const q = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/**
 * Almacenamiento en Google Drive (experimental). Todo vive en una carpeta de la app; con el scope drive.file
 * la app no puede ver nada más de tu Drive. Las claves con "/" se aplanan a nombres de archivo con "__".
 */
export function gdriveStorage(
  opts: GoogleCreds & { refreshToken: () => Promise<string | undefined>; folderName?: string; endpoints?: Endpoints },
): StorageAdapter {
  const ep = { ...GOOGLE, ...opts.endpoints };
  let access: { value: string; exp: number } | undefined;
  let folder: Promise<string> | undefined;
  const ids = new Map<string, string>();

  async function accessToken(): Promise<string> {
    if (access && access.exp > Date.now() + 60_000) return access.value;
    const rt = await opts.refreshToken();
    if (!rt) throw new Error("gdrive-not-connected");
    const r = await fetch(ep.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        refresh_token: rt,
        grant_type: "refresh_token",
      }),
    });
    if (!r.ok) throw new Error(`gdrive token refresh: HTTP ${r.status}`);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    access = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return access.value;
  }
  const call = async (url: string, init: RequestInit = {}) =>
    fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${await accessToken()}` } });
  const json = async <T>(r: Response, what: string): Promise<T> => {
    if (!r.ok) throw new Error(`gdrive ${what}: HTTP ${r.status}`);
    return (await r.json()) as T;
  };

  const folderId = () =>
    (folder ??= (async () => {
      const name = opts.folderName ?? "Feelingmark";
      const found = await json<{ files: { id: string }[] }>(
        await call(
          `${ep.api}/files?${new URLSearchParams({ q: `name=${q(name)} and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: "files(id)" })}`,
        ),
        "find folder",
      );
      if (found.files[0]) return found.files[0].id;
      const made = await json<{ id: string }>(
        await call(`${ep.api}/files?fields=id`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
        }),
        "create folder",
      );
      return made.id;
    })().catch((e) => {
      folder = undefined; // reintenta en la siguiente llamada
      throw e;
    }));

  const fileName = (key: string) => key.replaceAll("/", "__");

  async function findId(name: string): Promise<string | undefined> {
    const cached = ids.get(name);
    if (cached) return cached;
    const parent = await folderId();
    const found = await json<{ files: { id: string }[] }>(
      await call(
        `${ep.api}/files?${new URLSearchParams({ q: `name=${q(name)} and '${parent}' in parents and trashed=false`, fields: "files(id)" })}`,
      ),
      "find file",
    );
    if (found.files[0]) ids.set(name, found.files[0].id);
    return found.files[0]?.id;
  }

  return {
    async put(key, data) {
      const name = fileName(key);
      const id = await findId(name);
      if (id) {
        const r = await call(`${ep.upload}/files/${id}?uploadType=media`, { method: "PATCH", body: data as Uint8Array<ArrayBuffer> });
        if (!r.ok) throw new Error(`gdrive update ${key}: HTTP ${r.status}`);
        return;
      }
      const boundary = `fm${crypto.randomUUID()}`;
      const meta = JSON.stringify({ name, parents: [await folderId()] });
      const enc = new TextEncoder();
      const body = new Blob([
        enc.encode(
          `--${boundary}\r\ncontent-type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`,
        ),
        data as Uint8Array<ArrayBuffer>,
        enc.encode(`\r\n--${boundary}--`),
      ]);
      const made = await json<{ id: string }>(
        await call(`${ep.upload}/files?uploadType=multipart&fields=id`, {
          method: "POST",
          headers: { "content-type": `multipart/related; boundary=${boundary}` },
          body,
        }),
        `create ${key}`,
      );
      ids.set(name, made.id);
    },
    async get(key) {
      const id = await findId(fileName(key));
      if (!id) throw new Error(`gdrive object not found: ${key}`);
      const r = await call(`${ep.api}/files/${id}?alt=media`);
      if (!r.ok) throw new Error(`gdrive get ${key}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    },
  };
}
