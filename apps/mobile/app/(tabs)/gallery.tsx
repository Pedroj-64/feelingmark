import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Play } from "phosphor-react-native";
import { createApi, type Api, type TimelineItem } from "../../src/api";
import { useTimeline } from "../../src/use-timeline";
import { loadConn } from "../../src/settings";
import { useTheme } from "../../src/theme";
import { Skeleton, Text } from "../../src/ui";

const COLS = 3;
const GAP = 3;
type Row = { kind: "head"; key: string; month: string } | { kind: "row"; key: string; items: TimelineItem[] };

/** Galería: toda la biblioteca como una cuadrícula continua, por meses, de lo más reciente a lo más antiguo. Carga por páginas. */
export default function Gallery() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  const { items, error, reset, more } = useTimeline();
  const [noServer, setNoServer] = useState(false);

  // Al volver a la pestaña se empieza de cero: así aparece lo recién subido.
  useFocusEffect(
    useCallback(() => {
      loadConn().then((conn) => {
        if (!conn) return setNoServer(true);
        setNoServer(false);
        const a = createApi(conn);
        setApi(a);
        void reset(a);
      });
    }, [reset]),
  );

  const size = (Math.min(width, 720) - 32 - GAP * (COLS - 1)) / COLS;
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let cur = "";
    let buf: TimelineItem[] = [];
    const flush = () => {
      for (let i = 0; i < buf.length; i += COLS) out.push({ kind: "row", key: `${buf[i].id}`, items: buf.slice(i, i + COLS) });
      buf = [];
    };
    for (const it of items ?? []) {
      const m = it.takenAt.slice(0, 7);
      if (m !== cur) {
        flush();
        cur = m;
        out.push({ kind: "head", key: `h${m}`, month: m });
      }
      buf.push(it);
    }
    flush();
    return out;
  }, [items]);
  const monthLabel = (m: string) => {
    const d = new Date(`${m}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return d.charAt(0).toUpperCase() + d.slice(1);
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={{ width: Math.min(width, 720), alignSelf: "center", flex: 1, paddingHorizontal: 16 }}>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("tabs.gallery")}
        </Text>
        {noServer && <Text style={{ color: c.muted, marginTop: 12 }}>{t("home.connectTitle")}</Text>}
        {items === null && !noServer && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} style={{ width: size, height: size, borderRadius: 6 }} />
            ))}
          </View>
        )}
        {items?.length === 0 && <Text style={{ color: c.muted, marginTop: 12 }}>{t("gallery.empty")}</Text>}
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          onEndReached={() => api && void more(api)}
          onEndReachedThreshold={0.6}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: 24 }}
          ListFooterComponent={
            error ? <Text style={{ color: c.muted, textAlign: "center", marginTop: 12 }}>{t("gallery.loadError")}</Text> : undefined
          }
          renderItem={({ item: r }) =>
            r.kind === "head" ? (
              <Text accessibilityRole="header" style={[s.month, { color: c.ink }]}>
                {monthLabel(r.month)}
              </Text>
            ) : (
              <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
                {r.items.map((it) => (
                  <Pressable
                    key={it.id}
                    accessibilityRole="button"
                    accessibilityLabel={new Date(it.takenAt.slice(0, 10) + "T12:00:00").toLocaleDateString(i18n.language, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    onPress={() =>
                      router.push({
                        pathname: "/day",
                        params: { date: it.takenAt.slice(0, 10), ids: String(it.id), videos: it.video ? String(it.id) : "" },
                      })
                    }
                    style={{ width: size, height: size, borderRadius: 6, overflow: "hidden", backgroundColor: c.surface }}
                  >
                    {api && (
                      <Image
                        source={api.thumbSource(it.id)}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="disk"
                        recyclingKey={String(it.id)}
                        accessible={false}
                      />
                    )}
                    {it.video && (
                      <View style={s.play}>
                        <Play size={14} weight="fill" color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 16, marginBottom: 4 },
  month: { fontSize: 18, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.2, marginTop: 20, marginBottom: 10 },
  play: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(22,19,15,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
