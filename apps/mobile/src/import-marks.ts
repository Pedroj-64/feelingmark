import { File, Paths } from "expo-file-system";

/** Por álbum de la galería: fecha (ms) de lo más reciente ya importado, para que la próxima vez solo entre lo nuevo. */
const file = () => new File(Paths.document, "feelingmark-import-marks.json");

export async function loadMarks(): Promise<Record<string, number>> {
  try {
    const f = file();
    return f.exists ? (JSON.parse(await f.text()) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export async function saveMark(albumId: string, mark: number) {
  const marks = await loadMarks();
  marks[albumId] = mark;
  const f = file();
  if (!f.exists) f.create();
  f.write(JSON.stringify(marks));
}
