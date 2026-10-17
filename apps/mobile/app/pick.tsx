import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Check } from "phosphor-react-native";
import { createApi, type Api, type TimelineItem } from "../src/api";
import { loadConn } from "../src/settings";
import { useTheme } from "../src/theme";
import { useTimeline } from "../src/use-timeline";
import { Button, Skeleton, Text } from "../src/ui";

const COLS = 3;
const GAP = 3;

/** Elegir varias fotos o videos de tu biblioteca (ya subida) para meterlos en un álbum. */
export default function Pick() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  const [already, setAlready] = useState<Set<number>>(new Set());
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { items, error, reset, more } = useTimeline();

  useEffect(() => {
    loadConn().then((conn) => {
      if (!conn) return;
      const a = createApi(conn);
      setApi(a);
      void reset(a);
      a.collection(id).then(
        (d) => setAlready(new Set(d.items.map((x) => x.id))),
        () => undefined,
      );
    });
  }, [id, reset]);

  const size = (Math.min(width, 720) - 32 - GAP * (COLS - 1)) / COLS;
  const rows = useMemo(() => {
    const out: TimelineItem[][] = [];
    for (let i = 0; i < (items?.length ?? 0); i += COLS) out.push(items!.slice(i, i + COLS));
    return out;
  }, [items]);
  const toggle = (itemId: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (!next.delete(itemId)) next.add(itemId);
      return next;
    });
  const add = async () => {
    if (!api || chosen.size === 0) return;
    setBusy(true);
    try {
      await api.addToCollection(id, [...chosen]);
      router.back();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={{ width: Math.min(width, 720), alignSelf: "center", flex: 1, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" style={s.back}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("day.cancel")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("pick.title")}
        </Text>
        <Text style={{ color: c.muted, marginBottom: 12 }}>{t("pick.hint")}</Text>
        {items === null && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} style={{ width: size, height: size, borderRadius: 6 }} />
            ))}
          </View>
        )}
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r[0].id)}
          onEndReached={() => api && void more(api)}
          onEndReachedThreshold={0.6}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: 96 }}
          ListFooterComponent={
            error ? <Text style={{ color: c.muted, textAlign: "center", marginTop: 12 }}>{t("gallery.loadError")}</Text> : undefined
          }
          renderItem={({ item: r }) => (
            <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
              {r.map((it) => {
                const was = already.has(it.id);
                const on = chosen.has(it.id);
                return (
                  <Pressable
                    key={it.id}
                    disabled={was}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on || was, disabled: was }}
                    accessibilityLabel={was ? t("pick.already") : it.takenAt.slice(0, 10)}
                    onPress={() => toggle(it.id)}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: 6,
                      overflow: "hidden",
                      backgroundColor: c.surface,
                      opacity: was ? 0.4 : 1,
                    }}
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
                    {(on || was) && (
                      <View style={[s.check, { backgroundColor: c.accent }]}>
                        <Check size={14} weight="bold" color={c.onAccent} />
                      </View>
                    )}
                    {on && <View style={[StyleSheet.absoluteFill, { borderWidth: 3, borderColor: c.accent, borderRadius: 6 }]} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        />
        <View style={[s.bar, { backgroundColor: c.bg, borderColor: c.line }]}>
          {failed && <Text style={{ color: c.accent, marginBottom: 6 }}>{t("common.error")}</Text>}
          <Button label={t("pick.add", { count: chosen.size })} disabled={chosen.size === 0 || busy} onPress={add} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 26, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.4, marginTop: 4, marginBottom: 4 },
  check: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: { position: "absolute", left: 16, right: 16, bottom: 12, borderTopWidth: 1, paddingTop: 10 },
});
