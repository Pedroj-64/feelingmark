import { mkdirSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Capabilities } from "./app.ts";
import type { Db } from "./db.ts";
import { digest, ingest, isVideo, MIME_BY_EXT, resolveTakenAt, type DateSource } from "./ingest.ts";
import type { StorageAdapter } from "./storage.ts";

export type ImportReport = {
  scanned: number;
  imported: number;
  duplicates: number;
  errors: { file: string; error: string }[];
  skipped: number; // archivos que no son fotos ni videos admitidos
  photos: number;
  videos: number;
  bySource: Record<DateSource, number>;
  byMonth: Record<string, number>;
  byDay: Record<string, number>;
  first?: string;
  last?: string;
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue; // .thumbnails, .trashed-..., etc.
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

/** Recorre una carpeta e importa fotos y videos. Con dryRun no escribe nada: solo mide qué pasaría. */
export async function importFolder(
  dir: string,
  deps: { db: Db; storage: StorageAdapter } & Pick<Capabilities, "videoDate">,
  opts: { dryRun: boolean; onProgress?: (done: number, file: string) => void } = { dryRun: true },
): Promise<ImportReport> {
  const r: ImportReport = {
    scanned: 0,
    imported: 0,
    duplicates: 0,
    errors: [],
    skipped: 0,
    photos: 0,
    videos: 0,
    bySource: { user: 0, exif: 0, video: 0, filename: 0, file: 0 },
    byMonth: {},
    byDay: {},
  };
  const seen = new Set<string>(); // duplicados dentro de la propia carpeta (también en simulación)
  for await (const file of walk(dir)) {
    const mime = MIME_BY_EXT[extname(file).slice(1).toLowerCase()];
    if (!mime) {
      r.skipped++;
      continue;
    }
    r.scanned++;
    try {
      const bytes = new Uint8Array(await readFile(file));
      const lastModified = (await stat(file)).mtimeMs;
      let iso: string;
      let source: DateSource;
      if (opts.dryRun) {
        const hash = await digest("SHA-256", bytes);
        const known = seen.has(hash) || !!(await deps.db.get("SELECT 1 AS x FROM photos WHERE hash = ?", hash));
        seen.add(hash);
        if (known) {
          r.duplicates++;
          continue;
        }
        ({ iso, source } = await resolveTakenAt(bytes, mime, { name: basename(file), lastModified, videoDate: deps.videoDate }));
      } else {
        const res = await ingest(deps, { bytes, mime, name: basename(file), lastModified });
        if (res.duplicate) {
          r.duplicates++;
          continue;
        }
        iso = res.takenAt;
        source = res.source!;
        r.imported++;
      }
      r.bySource[source]++;
      r[isVideo(mime) ? "videos" : "photos"]++;
      r.byMonth[iso.slice(0, 7)] = (r.byMonth[iso.slice(0, 7)] ?? 0) + 1;
      r.byDay[iso.slice(0, 10)] = (r.byDay[iso.slice(0, 10)] ?? 0) + 1;
      if (!r.first || iso < r.first) r.first = iso;
      if (!r.last || iso > r.last) r.last = iso;
    } catch (e) {
      r.errors.push({ file, error: e instanceof Error ? e.message : String(e) });
    }
    opts.onProgress?.(r.scanned, file);
  }
  return r;
}

/** Avisos legibles si las fechas parecen poco fiables (p. ej. todo cae en el día de la descarga). */
export function warnings(r: ImportReport): string[] {
  const total = r.photos + r.videos;
  const out: string[] = [];
  if (total === 0) return out;
  const top = Object.entries(r.byDay).sort((a, b) => b[1] - a[1])[0];
  if (total >= 10 && top && top[1] / total > 0.5)
    out.push(
      `${Math.round((top[1] / total) * 100)}% de los archivos caen en un solo día (${top[0]}): la fecha probablemente es la de la descarga, no la del recuerdo.`,
    );
  if (total >= 10 && r.bySource.file / total > 0.3)
    out.push(
      `${Math.round((r.bySource.file / total) * 100)}% usa solo la fecha del archivo (sin metadatos ni nombre con fecha): revísalo antes de importar.`,
    );
  return out;
}

export function formatReport(r: ImportReport, dryRun: boolean): string {
  const total = r.photos + r.videos;
  const months = Object.entries(r.byMonth).sort(([a], [b]) => (a < b ? -1 : 1));
  const L: string[] = [];
  L.push(dryRun ? "== SIMULACIÓN (no se guardó nada) ==" : "== IMPORTACIÓN TERMINADA ==");
  L.push(`Archivos revisados: ${r.scanned} (omitidos por no ser foto/video: ${r.skipped})`);
  L.push(
    `${dryRun ? "Se importarían" : "Importados"}: ${total}  (${r.photos} fotos, ${r.videos} videos) · duplicados: ${r.duplicates} · errores: ${r.errors.length}`,
  );
  L.push(
    `Origen de la fecha: metadatos de foto ${r.bySource.exif} · metadatos de video ${r.bySource.video} · nombre del archivo ${r.bySource.filename} · fecha del archivo ${r.bySource.file}`,
  );
  if (r.first) L.push(`Rango: ${r.first.slice(0, 10)} → ${r.last!.slice(0, 10)} en ${months.length} meses`);
  if (months.length)
    L.push(
      "Por mes: " +
        months
          .slice(-12)
          .map(([m, n]) => `${m}=${n}`)
          .join("  ") +
        (months.length > 12 ? "  (últimos 12)" : ""),
    );
  for (const w of warnings(r)) L.push(`⚠ ${w}`);
  for (const e of r.errors.slice(0, 10)) L.push(`✖ ${e.file}: ${e.error}`);
  if (r.errors.length > 10) L.push(`… y ${r.errors.length - 10} errores más`);
  if (dryRun) L.push("Si todo se ve bien, repite con --apply para guardarlo.");
  return L.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir || args.includes("--help")) {
    console.log(
      "Uso: node src/import.ts <carpeta> [--apply]\n  Sin --apply solo simula. Usa las mismas variables que el servidor (DATABASE_PATH, STORAGE_PATH, STORAGE_DRIVER...).",
    );
    process.exit(dir ? 0 : 1);
  }
  const apply = args.includes("--apply");
  const [{ openDb }, { videoDate }, { pickStorage }] = await Promise.all([
    import("./db-node.ts"),
    import("./node-tools.ts"),
    import("./storage-env.ts"),
  ]);
  const dbPath = process.env.DATABASE_PATH ?? "./data/feelingmark.sqlite";
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = await openDb(dbPath);
  const storage = pickStorage(db);
  const report = await importFolder(
    dir,
    { db, storage, videoDate },
    {
      dryRun: !apply,
      onProgress: (n) => n % 25 === 0 && process.stderr.write(`\r${n} archivos…`),
    },
  );
  process.stderr.write("\r");
  console.log(formatReport(report, !apply));
  process.exit(report.errors.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
