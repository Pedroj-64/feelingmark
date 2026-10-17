import { Album, Query, MediaType, AssetField, requestPermissionsAsync } from "expo-media-library";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { isNew, mimeFromName, wallClock } from "../src/gallery";
import { loadMarks, saveMark } from "../src/import-marks";
import { enqueue } from "../src/queue";
import { queueStore } from "../src/queue-store";
import { Text } from "../src/ui";
import { useTheme } from "../src/theme";

type Row = { id: string; title: string; album: Album };

/** Elegir un álbum de la galería e importar solo lo que aún no se ha importado de él. Las fotos entran a la cola de subidas. */
export default function ImportAlbum() {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await requestPermissionsAsync(false, ["photo", "video"]);
      if (!p.granted) return setDenied(true);
      const all = await Album.getAll();
      const titled = await Promise.all(all.map(async (album) => ({ id: album.id, title: await album.getTitle(), album })));
      setRows(titled.sort((a, b) => a.title.localeCompare(b.title)));
    })().catch(() => setDenied(true));
  }, []);

  async function importAlbum(row: Row) {
    setBusy(row.id);
    setMsg(null);
    try {
      const mark = (await loadMarks())[row.id] ?? 0;
      const assets = await new Query().album(row.album).orderBy({ key: AssetField.CREATION_TIME, ascending: true }).exe();
      let newest = mark;
      let added = 0;
      for (let i = 0; i < assets.length; i += 25) {
        // por tandas: no se piden los datos de miles de archivos a la vez
        const chunk = await Promise.all(assets.slice(i, i + 25).map((a) => a.getInfo().catch(() => null)));
        const items = [];
        for (const info of chunk) {
          if (!info || !isNew(info.creationTime, mark)) continue;
          const mimeType = mimeFromName(info.filename);
          if (!mimeType || (info.mediaType !== MediaType.IMAGE && info.mediaType !== MediaType.VIDEO)) continue; // gif, audio…
          items.push({
            uri: info.uri,
            mimeType,
            fileName: info.filename,
            takenAt: info.creationTime ? wallClock(info.creationTime) : undefined,
          });
          if (info.creationTime) newest = Math.max(newest, info.creationTime);
        }
        added += await enqueue(queueStore, items);
        setMsg(t("import.preparing", { done: Math.min(i + 25, assets.length), total: assets.length }));
      }
      await saveMark(row.id, newest);
      setMsg(added === 0 ? t("import.nothingNew") : t("import.queued", { count: added }));
      if (added > 0) router.replace("/");
    } catch {
      setMsg(t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={s.back}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("tabs.home")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("import.title")}
        </Text>
        <Text style={{ color: c.muted, marginBottom: 16 }}>{t("import.hint")}</Text>
        {denied && (
          <>
            <Text style={{ color: c.ink, marginBottom: 12 }}>{t("import.denied")}</Text>
            <Pressable onPress={() => Linking.openSettings()} style={[s.btn, { backgroundColor: c.accent }]} accessibilityRole="button">
              <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("import.openSettings")}</Text>
            </Pressable>
          </>
        )}
        {!denied && !rows && <ActivityIndicator color={c.accent} />}
        {msg && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.muted, marginBottom: 12 }}>
            {msg}
          </Text>
        )}
        {rows && (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            initialNumToRender={12}
            renderItem={({ item }) => (
              <Pressable
                disabled={busy !== null}
                onPress={() => importAlbum(item)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  s.row,
                  { borderColor: c.line, opacity: busy && busy !== item.id ? 0.4 : 1, transform: [{ translateY: pressed ? 1 : 0 }] },
                ]}
              >
                <Text style={{ color: c.ink, fontSize: 16, flex: 1 }}>{item.title}</Text>
                {busy === item.id ? <ActivityIndicator color={c.accent} /> : <Count album={item.album} color={c.muted} />}
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Count({ album, color }: { album: Album; color: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(
    () =>
      void album
        .getAssetCount()
        .then(setN)
        .catch(() => undefined),
    [album],
  );
  return <Text style={{ color, fontVariant: ["tabular-nums"] }}>{n ?? ""}</Text>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: 16, width: "100%", maxWidth: 720, alignSelf: "center" },
  back: { minHeight: 44, justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.4, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 56, borderBottomWidth: 1, gap: 12 },
  btn: { borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
