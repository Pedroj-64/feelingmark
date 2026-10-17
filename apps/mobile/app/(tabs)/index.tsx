import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { FolderOpen, ImagesSquare, MagnifyingGlass, Play, QrCode } from "phosphor-react-native";
import { createApi, type Album, type Api, type Memory, type MonthData } from "../../src/api";
import { loadConn } from "../../src/settings";
import { useTheme } from "../../src/theme";
import { flushQueue, pickAndEnqueue } from "../../src/uploads";
import { Button, Skeleton, Text } from "../../src/ui";

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type State =
  | { kind: "loading" }
  | { kind: "no-server" }
  | { kind: "ready"; api: Api; month: MonthData | null; memories: Memory[]; albums: Album[]; offline: boolean };

/** Inicio: dice qué hacer según el momento (conectar, primera foto) y, ya en uso, muestra hoy, un día como hoy y el resumen. */
export default function Home() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [status, setStatus] = useState<string | null>(null);
  const day = today();
  const w = Math.min(width, 720) - 32;

  const load = useCallback(async () => {
    const conn = await loadConn();
    if (!conn) return setState({ kind: "no-server" });
    const api = createApi(conn);
    const [month, memories, albums] = await Promise.allSettled([api.month(day.slice(0, 7)), api.memories(day), api.albums()]);
    setState({
      kind: "ready",
      api,
      month: month.status === "fulfilled" ? month.value : null,
      memories: memories.status === "fulfilled" ? memories.value : [],
      albums: albums.status === "fulfilled" ? albums.value : [],
      offline: month.status === "rejected" && albums.status === "rejected",
    });
    return api;
  }, [day]);

  // Sube lo pendiente al volver a la pantalla y refresca lo que se vea.
  useFocusEffect(
    useCallback(() => {
      load().then(async (api) => {
        if (!api) return;
        const r = await flushQueue(api, (left) => setStatus(t("calendar.uploadingLeft", { count: left })));
        setStatus(r && r.left > 0 ? t("calendar.pending", { count: r.left }) : null);
        if (r && r.done > 0) void load();
      });
    }, [load, t]),
  );

  const pick = async () => {
    if (state.kind !== "ready") return;
    if ((await pickAndEnqueue()) > 0) {
      const r = await flushQueue(state.api, (left) => setStatus(t("calendar.uploadingLeft", { count: left })));
      setStatus(r && r.done > 0 ? t("calendar.uploaded", { count: r.done }) : null);
      void load();
    }
  };

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "home.morning" : hour < 19 ? "home.afternoon" : "home.evening");
  const rawDate = new Date().toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" });
  const dateLine = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);
  const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long" });
  const openDay = (date: string, ids: number[], videos: number[], note?: string) =>
    router.push({ pathname: "/day", params: { date, ids: ids.join(","), videos: videos.join(","), note: note ?? "" } });

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", padding: 16, paddingBottom: 40 }}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
              {greeting}
            </Text>
            <Text style={{ color: c.muted }}>{dateLine}</Text>
          </View>
          {state.kind === "ready" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("home.search")}
              onPress={() => router.push("/search")}
              hitSlop={8}
              style={[s.round, { borderColor: c.line }]}
            >
              <MagnifyingGlass size={22} color={c.ink} />
            </Pressable>
          )}
        </View>

        {state.kind === "loading" && (
          <>
            <Skeleton style={{ height: w * 0.62, borderRadius: 20 }} />
            <Skeleton style={{ height: 22, width: 140, marginTop: 28 }} />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <Skeleton style={{ width: 130, height: 170, borderRadius: 16 }} />
              <Skeleton style={{ width: 130, height: 170, borderRadius: 16 }} />
            </View>
          </>
        )}

        {state.kind === "no-server" && (
          <Guide title={t("home.connectTitle")} body={t("home.connectBody")}>
            {Platform.OS !== "web" && (
              <Button label={t("scan.action")} icon={<QrCode size={22} color={c.onAccent} />} onPress={() => router.push("/scan")} />
            )}
            <Button kind="ghost" label={t("home.connectManual")} onPress={() => router.navigate("/settings")} />
          </Guide>
        )}

        {state.kind === "ready" && ready(state)}
        {status && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.muted, textAlign: "center", marginTop: 20 }}>
            {status}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function ready(st: Extract<State, { kind: "ready" }>) {
    const ids = st.month?.days[day] ?? [];
    const empty = st.albums.length === 0 && ids.length === 0 && st.memories.length === 0;
    const recap = st.month?.video ? st.albums.find((a) => a.count >= 3) : undefined;

    if (empty && !st.offline)
      return (
        <Guide title={t("home.firstTitle")} body={t("home.firstBody")}>
          <Button label={t("home.pick")} icon={<ImagesSquare size={22} color={c.onAccent} />} onPress={pick} />
          {Platform.OS !== "web" && (
            <Button
              kind="ghost"
              label={t("home.importAlbum")}
              icon={<FolderOpen size={22} color={c.accent} />}
              onPress={() => router.push("/import")}
            />
          )}
        </Guide>
      );

    return (
      <>
        {st.offline && <Text style={{ color: c.muted, marginBottom: 12 }}>{t("calendar.offline")}</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("home.today")}. ${ids.length > 0 ? t("albums.count", { count: ids.length }) : t("home.todayEmpty")}`}
          onPress={() =>
            ids.length > 0 ? openDay(day, ids, st.month?.videos?.filter((v) => ids.includes(v)) ?? [], st.month?.notes?.[day]) : pick()
          }
          style={({ pressed }) => [
            s.today,
            {
              height: ids.length > 0 ? w * 0.6 : undefined,
              backgroundColor: c.surface,
              borderColor: c.line,
              transform: [{ translateY: pressed ? 1 : 0 }],
            },
          ]}
        >
          {ids.length > 0 ? (
            <>
              <Image
                source={st.api.thumbSource(ids[0])}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="disk"
                accessible={false}
              />
              <View style={s.scrim} />
              <Text style={s.todayLabel}>{t("home.today")}</Text>
            </>
          ) : (
            <View style={s.todayEmpty}>
              <Text style={{ color: c.ink, fontSize: 18, fontWeight: "600" }}>{t("home.today")}</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>{t("home.todayEmpty")}</Text>
            </View>
          )}
        </Pressable>

        {st.memories.length > 0 && (
          <>
            <Text accessibilityRole="header" style={[s.section, { color: c.ink }]}>
              {t("home.memories")}
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={st.memories}
              keyExtractor={(m) => m.date}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item: m }) => {
                const years = +day.slice(0, 4) - +m.date.slice(0, 4);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("home.yearsAgo", { count: years })}
                    onPress={() => openDay(m.date, m.ids, m.videos, m.note)}
                    style={({ pressed }) => [s.memory, { backgroundColor: c.surface, transform: [{ translateY: pressed ? 1 : 0 }] }]}
                  >
                    {m.ids[0] != null && (
                      <Image
                        source={st.api.thumbSource(m.ids[0])}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="disk"
                        accessible={false}
                      />
                    )}
                    <View style={s.scrim} />
                    <Text style={s.memoryLabel}>{t("home.yearsAgo", { count: years })}</Text>
                  </Pressable>
                );
              }}
            />
          </>
        )}

        {recap && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/recap", params: { month: recap.month } })}
            style={({ pressed }) => [
              s.recap,
              { backgroundColor: c.surface, borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] },
            ]}
          >
            <View style={[s.recapThumb, { backgroundColor: c.line }]}>
              <Image
                source={st.api.thumbSource(recap.cover)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="disk"
                accessible={false}
              />
              <View style={s.playBadge}>
                <Play size={20} weight="fill" color="#fff" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: "600" }}>{t("home.recap", { month: monthName(recap.month) })}</Text>
              <Text style={{ color: c.muted, marginTop: 2 }}>{t("home.recapHint")}</Text>
            </View>
          </Pressable>
        )}

        <View style={s.actions}>
          <Button label={t("home.add")} onPress={pick} style={{ flex: 1 }} />
          {Platform.OS !== "web" && (
            <Button kind="ghost" label={t("home.importAlbum")} onPress={() => router.push("/import")} style={{ flex: 1 }} />
          )}
        </View>
      </>
    );
  }
}

/** Tarjeta de guía: un título, una frase y las acciones posibles. */
function Guide({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={[s.guide, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text accessibilityRole="header" style={[s.guideTitle, { color: c.ink }]}>
        {title}
      </Text>
      <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24, marginBottom: 20 }}>{body}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, marginBottom: 20 },
  title: { fontSize: 30, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.6 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  today: { minHeight: 120, borderRadius: 20, borderWidth: 1, overflow: "hidden", justifyContent: "flex-end" },
  todayEmpty: { padding: 20, justifyContent: "center" },
  todayLabel: { color: "#fff", fontSize: 20, fontWeight: "600", padding: 16 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(22,19,15,0.28)" },
  section: { fontSize: 20, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.3, marginTop: 28, marginBottom: 12 },
  memory: { width: 132, height: 176, borderRadius: 16, overflow: "hidden", justifyContent: "flex-end" },
  memoryLabel: { color: "#fff", fontSize: 14, fontWeight: "600", padding: 10 },
  recap: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: 20, padding: 12, marginTop: 28 },
  recapThumb: { width: 72, height: 72, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  playBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(22,19,15,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 28 },
  guide: { borderWidth: 1, borderRadius: 24, padding: 22, marginTop: 8 },
  guideTitle: { fontSize: 24, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.4, marginBottom: 8 },
});
