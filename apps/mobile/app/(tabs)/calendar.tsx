import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaretDown } from "phosphor-react-native";
import { Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Api, type MonthData } from "../../src/api";
import { monthGrid, shiftMonth } from "../../src/calendar";
import { monthCache } from "../../src/month-cache-store";
import { loadConn } from "../../src/settings";
import { useTheme } from "../../src/theme";
import { MonthPicker } from "../../src/month-picker";
import { flushQueue, pickAndEnqueue } from "../../src/uploads";
import { Button, Skeleton, Text } from "../../src/ui";

const today = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // día local, no UTC
})();

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
  const [picking, setPicking] = useState(false);

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

  const cell = (Math.min(width, 720) - 32) / 7; // 16 px de margen a cada lado
  const dayLabel = (d: string, photos: number, hasNote: boolean, hasVideo: boolean) =>
    [
      new Date(`${d}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" }),
      photos > 0 ? t("albums.count", { count: photos }) : null,
      hasVideo ? t("a11y.hasVideo") : null,
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
  const flush = useCallback(
    async (a: Api, month: string) => {
      const r = await flushQueue(a); // el avance lo muestra el aviso flotante
      if (r && r.done > 0) await load(a, month);
    },
    [load],
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
    if ((await pickAndEnqueue()) > 0) await flush(api, ym);
  }

  async function shareMonth(video: boolean) {
    if (!api) return;
    try {
      const link = await api.share(ym);
      if (video) return void router.push({ pathname: "/recap", params: { month: ym } });
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${t("picker.open")}`}
            onPress={() => setPicking(true)}
            hitSlop={8}
            style={s.titleBtn}
          >
            <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
              {title}
            </Text>
            <CaretDown size={18} color={c.muted} />
          </Pressable>
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
                  accessibilityRole="button"
                  accessibilityLabel={dayLabel(d, ids?.length ?? 0, Boolean(note), Boolean(ids?.some((x) => data?.videos?.includes(x))))}
                  onPress={() =>
                    router.push({
                      pathname: "/day",
                      params: {
                        date: d,
                        ids: (ids ?? []).join(","),
                        videos: (ids ?? []).filter((x) => data?.videos?.includes(x)).join(","),
                        note: note ?? "",
                      },
                    })
                  }
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
                      {ids?.some((x) => data?.videos?.includes(x)) && <Text style={s.play}>▶</Text>}
                      {ids && ids.length > 1 && <Text style={s.count}>{ids.length}</Text>}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
        {!data && !status && (
          <View style={{ paddingHorizontal: 16, gap: 6 }}>
            {[0, 1, 2, 3, 4].map((r) => (
              <View key={r} style={{ flexDirection: "row", gap: 6 }}>
                {Array.from({ length: 7 }, (_, i) => (
                  <Skeleton key={i} style={{ flex: 1, height: cell - 8 }} />
                ))}
              </View>
            ))}
          </View>
        )}
        {empty && !status && <Text style={[s.msg, { color: c.muted }]}>{t("calendar.empty")}</Text>}
        {status && (
          <Text accessibilityLiveRegion="polite" style={[s.msg, { color: c.muted }]}>
            {status}
          </Text>
        )}
        <Button label={t("calendar.add")} disabled={!api} onPress={add} style={{ margin: 16, marginTop: 24 }} />
        {!empty && data && (
          <View style={s.secondary}>
            {data.video && <Button kind="ghost" label={t("calendar.video")} onPress={() => shareMonth(true)} style={{ flex: 1 }} />}
            <Button kind="ghost" label={t("calendar.share")} onPress={() => shareMonth(false)} style={{ flex: 1 }} />
          </View>
        )}
      </ScrollView>
      <MonthPicker visible={picking} ym={ym} api={api} onPick={(m) => (setData(null), setYm(m))} onClose={() => setPicking(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 20 },
  nav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  title: { fontSize: 24, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.4 },
  row: { flexDirection: "row", paddingHorizontal: 16 },
  wd: { textAlign: "center", fontSize: 12, paddingBottom: 6 },
  cell: { flex: 1, borderRadius: 12, borderWidth: 1.5, overflow: "hidden", padding: 5 },
  num: { fontSize: 12, fontVariant: ["tabular-nums"], textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 3 },
  play: { position: "absolute", left: 6, bottom: 4, color: "#fff", fontSize: 11, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
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
  msg: { textAlign: "center", marginTop: 20, paddingHorizontal: 16 },
});
