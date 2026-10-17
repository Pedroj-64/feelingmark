import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Plus, Users } from "phosphor-react-native";
import { createApi, type Album, type Api, type Collection } from "../../src/api";
import { PromptModal } from "../../src/prompt-modal";
import { loadConn } from "../../src/settings";
import { useTheme } from "../../src/theme";
import { Skeleton, Text } from "../../src/ui";

/** Álbumes propios (con nombre y portada) arriba; debajo, los de cada mes, creados solos a partir de las fechas. */
export default function Albums() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  const [months, setMonths] = useState<Album[] | null>(null);
  const [mine, setMine] = useState<Collection[] | null>(null);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadConn().then(async (conn) => {
        if (!conn) return setError(true);
        const a = createApi(conn);
        setApi(a);
        const [m, p] = await Promise.allSettled([a.albums(), a.collections()]);
        setMonths(m.status === "fulfilled" ? m.value : []);
        setMine(p.status === "fulfilled" ? p.value : []);
        setError(m.status === "rejected" && p.status === "rejected");
      });
    }, []),
  );

  const gap = 12;
  const card = (Math.min(width, 720) - 16 * 2 - gap) / 2;
  const years = useMemo(() => {
    const by = new Map<string, Album[]>();
    for (const al of months ?? []) by.set(al.month.slice(0, 4), [...(by.get(al.month.slice(0, 4)) ?? []), al]);
    return [...by.entries()]; // los álbumes ya vienen del más reciente al más antiguo
  }, [months]);
  const monthName = (month: string) => {
    const m = new Date(`${month}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  };
  const monthLabel = (month: string) => {
    const d = new Date(`${month}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return d.charAt(0).toUpperCase() + d.slice(1);
  };

  const create = async (name: string) => {
    setCreating(false);
    if (!api) return;
    try {
      const id = await api.createCollection(name);
      router.push({ pathname: "/album", params: { id: String(id) } });
    } catch {
      setError(true);
    }
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", padding: 16, paddingBottom: 32 }}>
        <View style={s.head}>
          <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
            {t("tabs.albums")}
          </Text>
          {api && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("albums2.new")}
              onPress={() => setCreating(true)}
              style={({ pressed }) => [s.add, { backgroundColor: c.accent, transform: [{ translateY: pressed ? 1 : 0 }] }]}
            >
              <Plus size={20} color={c.onAccent} weight="bold" />
              <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("albums2.new")}</Text>
            </Pressable>
          )}
        </View>
        {error && <Text style={{ color: c.muted, marginBottom: 12 }}>{t("calendar.offline")}</Text>}

        <Text accessibilityRole="header" style={[s.section, { color: c.ink }]}>
          {t("albums2.mine")}
        </Text>
        {!mine && !error && (
          <View style={{ flexDirection: "row", gap }}>
            <Skeleton style={{ width: card, height: card, borderRadius: 16 }} />
            <Skeleton style={{ width: card, height: card, borderRadius: 16 }} />
          </View>
        )}
        {mine?.length === 0 && <Text style={{ color: c.muted, lineHeight: 22 }}>{t("albums2.emptyMine")}</Text>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
          {mine?.map((al) => (
            <Pressable
              key={al.id}
              accessibilityRole="button"
              accessibilityLabel={`${al.name}, ${t("album.count", { count: al.count })}`}
              onPress={() => router.push({ pathname: "/album", params: { id: String(al.id) } })}
              style={({ pressed }) => [{ width: card, transform: [{ translateY: pressed ? 1 : 0 }] }]}
            >
              <View style={[s.cover, { width: card, height: card, backgroundColor: c.surface, borderColor: c.line }]}>
                {api && al.cover != null && (
                  <Image
                    source={api.thumbSource(al.cover)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="disk"
                    accessible={false}
                  />
                )}
                {al.shared && (
                  <View style={s.badge}>
                    <Users size={14} color="#fff" weight="fill" />
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{al.people}</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={[s.name, { color: c.ink }]}>
                {al.name}
              </Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{t("album.count", { count: al.count })}</Text>
            </Pressable>
          ))}
        </View>

        <Text accessibilityRole="header" style={[s.section, { color: c.ink, marginTop: 32 }]}>
          {t("albums2.byMonth")}
        </Text>
        {!months && !error && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {[0, 1].map((i) => (
              <Skeleton key={i} style={{ width: card, height: card, borderRadius: 16 }} />
            ))}
          </View>
        )}
        {months?.length === 0 && <Text style={{ color: c.muted }}>{t("albums.empty")}</Text>}
        {years.map(([year, list]) => (
          <View key={year} style={{ marginBottom: 20 }}>
            <Text accessibilityRole="header" style={[s.year, { color: c.muted }]}>
              {year}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
              {list.map((al) => (
                <Pressable
                  key={al.month}
                  accessibilityRole="button"
                  accessibilityLabel={`${monthLabel(al.month)}, ${t("albums.count", { count: al.count })}`}
                  onPress={() => router.navigate({ pathname: "/calendar", params: { month: al.month } })}
                  style={({ pressed }) => [{ width: card, transform: [{ translateY: pressed ? 1 : 0 }] }]}
                >
                  <View style={[s.cover, { width: card, height: card, backgroundColor: c.surface, borderColor: c.line }]}>
                    {api && (
                      <Image
                        source={api.thumbSource(al.cover)}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="disk"
                        accessible={false}
                      />
                    )}
                  </View>
                  <Text style={[s.name, { color: c.ink }]}>{monthName(al.month)}</Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>{t("albums.count", { count: al.count })}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <PromptModal
        visible={creating}
        title={t("albums2.newTitle")}
        placeholder={t("albums2.namePlaceholder")}
        confirm={t("albums2.create")}
        onSubmit={create}
        onClose={() => setCreating(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 16 },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5 },
  add: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, minHeight: 44, paddingHorizontal: 14 },
  section: { fontSize: 20, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.3, marginBottom: 12 },
  year: { fontSize: 14, fontWeight: "600", letterSpacing: 0.6, marginBottom: 10 },
  cover: { borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  badge: {
    position: "absolute",
    right: 8,
    top: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(22,19,15,0.6)",
  },
  name: { fontSize: 16, fontWeight: "600", marginTop: 8 },
});
