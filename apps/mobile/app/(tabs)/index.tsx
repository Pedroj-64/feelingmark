import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useMemo, useState } from "react";
import { Linking, Platform, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { createApi, type Api, type MonthData } from "../../src/api";
import { monthGrid, shiftMonth } from "../../src/calendar";
import { loadConn } from "../../src/settings";
import { useTheme } from "../../src/theme";

const today = new Date().toISOString().slice(0, 10);

// "2021:03:04 05:06:07" -> hora local ISO sin zona
const exifDate = (v: unknown) => (typeof v === "string" ? v.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T") : undefined);

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [data, setData] = useState<MonthData | null>(null);
  const [api, setApi] = useState<Api | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async (a: Api, m: string) => {
    try {
      setData(await a.month(m));
      setStatus(null);
    } catch {
      setStatus(t("calendar.offline"));
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    loadConn().then((conn) => {
      if (!conn) return setStatus(t("settings.title"));
      const a = createApi(conn);
      setApi(a);
      load(a, ym);
    });
  }, [ym, load, t]));

  const cell = Math.min(width, 720) / 7;
  const grid = useMemo(() => monthGrid(+ym.slice(0, 4), +ym.slice(5), 1), [ym]);
  const rawTitle = new Date(`${ym}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(i18n.language, { weekday: "narrow", timeZone: "UTC" })), [i18n.language]);

  async function add() {
    if (!api) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, exif: true });
    if (res.canceled) return;
    setStatus(t("calendar.uploading"));
    try {
      for (const a of res.assets) await api.upload({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, file: a.file, takenAt: exifDate(a.exif?.DateTimeOriginal) });
      await load(api, ym);
      setStatus(t("calendar.uploaded", { count: res.assets.length }));
    } catch {
      setStatus(t("common.error"));
    }
  }

  async function shareMonth(video: boolean) {
    if (!api) return;
    try {
      const link = await api.share(ym);
      if (video) return void Linking.openURL(`${link}/video`);
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(link);
        setStatus(t("calendar.linkCopied"));
      } else await Share.share({ message: link });
    } catch {
      setStatus(t("common.error"));
    }
  }

  const go = (d: number) => { setData(null); setYm(shiftMonth(ym, d)); };
  const rows = Array.from({ length: grid.length / 7 }, (_, r) => grid.slice(r * 7, r * 7 + 7));
  const empty = data && Object.keys(data.days).length === 0 && Object.keys(data.notes ?? {}).length === 0;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", paddingBottom: 32 }}>
        <View style={s.head}>
          <Pressable onPress={() => go(-1)} hitSlop={12} style={s.nav}><Text style={{ color: c.ink, fontSize: 22 }}>‹</Text></Pressable>
          <Text style={[s.title, { color: c.ink }]}>{title}</Text>
          <Pressable onPress={() => go(1)} hitSlop={12} style={s.nav}><Text style={{ color: c.ink, fontSize: 22 }}>›</Text></Pressable>
        </View>
        <View style={s.row}>
          {weekdays.map((w, i) => <Text key={i} style={[s.wd, { width: cell, color: c.muted }]}>{w}</Text>)}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={s.row}>
            {row.map((d, i) => {
              const ids = d ? data?.days[d] : undefined;
              const note = d ? data?.notes?.[d] : undefined;
              return (
                <Pressable key={i} disabled={!ids && !note} onPress={() => router.push({ pathname: "/day", params: { date: d!, ids: (ids ?? []).join(","), note: note ?? "" } })} style={{ width: cell, height: cell, padding: 2 }}>
                  {d && (
                    <View style={[s.cell, { borderColor: d === today ? c.accent : "transparent", backgroundColor: ids || note ? c.surface : "transparent" }]}>
                      {ids && api && <Image source={api.thumbSource(ids[0])} style={StyleSheet.absoluteFill} contentFit="cover" />}
                      <Text style={[s.num, { color: ids ? "#fff" : c.muted }]}>{+d.slice(8)}</Text>
                      {note && <View style={[s.noteDot, { backgroundColor: ids ? "#fff" : c.accent }]} />}
                      {ids && ids.length > 1 && <Text style={s.count}>{ids.length}</Text>}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
        {empty && !status && <Text style={[s.msg, { color: c.muted }]}>{t("calendar.empty")}</Text>}
        {status && <Text style={[s.msg, { color: c.muted }]}>{status}</Text>}
        <Pressable
          disabled={!api}
          onPress={add}
          style={({ pressed }) => [s.btn, { backgroundColor: c.accent, opacity: api ? 1 : 0.4, transform: [{ translateY: pressed ? 1 : 0 }] }]}
        >
          <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("calendar.add")}</Text>
        </Pressable>
        {!empty && data && (
          <View style={s.secondary}>
            {([["calendar.video", true], ["calendar.share", false]] as const).map(([k, v]) => (
              <Pressable key={k} onPress={() => shareMonth(v)} style={({ pressed }) => [s.ghost, { borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] }]}>
                <Text style={{ color: c.accent, fontWeight: "600" }}>{t(k)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 20 },
  nav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "600", letterSpacing: -0.4 },
  row: { flexDirection: "row" },
  wd: { textAlign: "center", fontSize: 12, paddingBottom: 6 },
  cell: { flex: 1, borderRadius: 12, borderWidth: 1.5, overflow: "hidden", padding: 5 },
  num: { fontSize: 12, fontVariant: ["tabular-nums"], textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 3 },
  count: { position: "absolute", right: 5, bottom: 3, color: "#fff", fontSize: 10, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  noteDot: { position: "absolute", left: 6, bottom: 6, width: 6, height: 6, borderRadius: 3 },
  secondary: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  ghost: { flex: 1, borderWidth: 1, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  msg: { textAlign: "center", marginTop: 20, paddingHorizontal: 16 },
  btn: { margin: 16, marginTop: 24, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
