import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Api, type MonthData } from "../../src/api";
import { monthGrid, shiftMonth } from "../../src/calendar";
import { monthCache } from "../../src/month-cache-store";
import { drain, enqueue } from "../../src/queue";
import { queueStore } from "../../src/queue-store";
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
  // Llegar desde un álbum (/?month=YYYY-MM) abre ese mes.
  const { month: monthParam } = useLocalSearchParams<{ month?: string }>();
  useEffect(() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) setYm(monthParam);
  }, [monthParam]);
  const [data, setData] = useState<MonthData | null>(null);
  const [api, setApi] = useState<Api | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(
    async (a: Api, m: string) => {
      try {
        const fresh = await a.month(m);
        setData(fresh);
        setStatus(null);
        monthCache.set(m, fresh).catch(() => undefined);
      } catch {
        // Sin servidor: se muestra lo último que se vio de ese mes (las miniaturas ya vistas están en la caché de disco).
        const cached = await monthCache.get(m).catch(() => undefined);
        if (cached) setData(cached);
        setStatus(t("calendar.offline"));
      }
    },
    [t],
  );

  const cell = Math.min(width, 720) / 7;
  const dayLabel = (d: string, photos: number, hasNote: boolean) =>
    [
      new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" }),
      photos > 0 ? t("albums.count", { count: photos }) : null,
      hasNote ? t("a11y.hasNote") : null,
    ]
      .filter(Boolean)
      .join(", ");
  const grid = useMemo(() => monthGrid(+ym.slice(0, 4), +ym.slice(5), 1), [ym]);
  const rawTitle = new Date(`${ym}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(i18n.language, { weekday: "narrow", timeZone: "UTC" }),
      ),
    [i18n.language],
  );

  // Sube lo pendiente de la cola (también lo que quedó de una sesión anterior).
  const flushing = useRef(false); // un solo vaciado de la cola a la vez
  const flush = useCallback(
    async (a: Api, month: string) => {
      if (flushing.current) return;
      flushing.current = true;
      let r;
      try {
        r = await drain(
          queueStore,
          (p) => a.upload(p),
          (left) => setStatus(t("calendar.uploadingLeft", { count: left })),
        );
      } finally {
        flushing.current = false;
      }
      if (r.done > 0) await load(a, month);
      if (r.left > 0) setStatus(t("calendar.pending", { count: r.left }));
      else if (r.dropped > 0) setStatus(t("calendar.dropped", { count: r.dropped }));
      else if (r.done > 0) setStatus(t("calendar.uploaded", { count: r.done }));
    },
    [load, t],
  );

  useFocusEffect(
    useCallback(() => {
      loadConn().then((conn) => {
        if (!conn) return setStatus(t("settings.title"));
        const a = createApi(conn);
        setApi(a);
        load(a, ym).then(() => flush(a, ym));
      });
    }, [ym, load, flush, t]),
  );

  async function add() {
    if (!api) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, exif: true });
    if (res.canceled) return;
    await enqueue(
      queueStore,
      res.assets.map((a) => ({
        uri: a.uri,
        mimeType: a.mimeType,
        fileName: a.fileName,
        file: a.file,
        takenAt: exifDate(a.exif?.DateTimeOriginal),
      })),
    );
    await flush(api, ym);
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

  const go = (d: number) => {
    setData(null);
    setYm(shiftMonth(ym, d));
  };
  const rows = Array.from({ length: grid.length / 7 }, (_, r) => grid.slice(r * 7, r * 7 + 7));
  const empty = data && Object.keys(data.days).length === 0 && Object.keys(data.notes ?? {}).length === 0;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", paddingBottom: 32 }}>
        <View style={s.head}>
          <Pressable onPress={() => go(-1)} hitSlop={12} style={s.nav} accessibilityRole="button" accessibilityLabel={t("a11y.prevMonth")}>
            <Text style={{ color: c.ink, fontSize: 22 }}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
            {title}
          </Text>
          <Pressable onPress={() => go(1)} hitSlop={12} style={s.nav} accessibilityRole="button" accessibilityLabel={t("a11y.nextMonth")}>
            <Text style={{ color: c.ink, fontSize: 22 }}>›</Text>
          </Pressable>
        </View>
        <View style={s.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {weekdays.map((w, i) => (
            <Text key={i} style={[s.wd, { width: cell, color: c.muted }]}>
              {w}
            </Text>
          ))}
        </View>
        {rows.map((row, r) => (
          <View key={r} style={s.row}>
            {row.map((d, i) => {
              const ids = d ? data?.days[d] : undefined;
              const note = d ? data?.notes?.[d] : undefined;
              if (!d) return <View key={i} style={{ width: cell, height: cell }} importantForAccessibility="no" />;
              return (
                <Pressable
                  key={i}
                  disabled={!ids && !note}
                  accessible={Boolean(ids || note)}
                  accessibilityRole={ids || note ? "button" : undefined}
                  accessibilityLabel={dayLabel(d, ids?.length ?? 0, Boolean(note))}
                  onPress={() => router.push({ pathname: "/day", params: { date: d, ids: (ids ?? []).join(","), note: note ?? "" } })}
                  style={{ width: cell, height: cell, padding: 2 }}
                >
                  {d && (
                    <View
                      style={[
                        s.cell,
                        { borderColor: d === today ? c.accent : "transparent", backgroundColor: ids || note ? c.surface : "transparent" },
                      ]}
                    >
                      {ids && api && (
                        <Image
                          source={api.thumbSource(ids[0])}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="disk"
                          accessible={false}
                        />
                      )}
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
        {status && (
          <Text accessibilityLiveRegion="polite" style={[s.msg, { color: c.muted }]}>
            {status}
          </Text>
        )}
        <Pressable
          disabled={!api}
          accessibilityRole="button"
          accessibilityState={{ disabled: !api }}
          onPress={add}
          style={({ pressed }) => [
            s.btn,
            { backgroundColor: c.accent, opacity: api ? 1 : 0.4, transform: [{ translateY: pressed ? 1 : 0 }] },
          ]}
        >
          <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("calendar.add")}</Text>
        </Pressable>
        {!empty && data && (
          <View style={s.secondary}>
            {(
              [
                ["calendar.video", true],
                ["calendar.share", false],
              ] as const
            )
              .filter(([k]) => k !== "calendar.video" || data.video)
              .map(([k, v]) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  onPress={() => shareMonth(v)}
                  style={({ pressed }) => [s.ghost, { borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] }]}
                >
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
  count: {
    position: "absolute",
    right: 5,
    bottom: 3,
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 3,
  },
  noteDot: { position: "absolute", left: 6, bottom: 6, width: 6, height: 6, borderRadius: 3 },
  secondary: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  ghost: { flex: 1, borderWidth: 1, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  msg: { textAlign: "center", marginTop: 20, paddingHorizontal: 16 },
  btn: { margin: 16, marginTop: 24, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
