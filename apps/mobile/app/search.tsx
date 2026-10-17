import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Api, type SearchHit } from "../src/api";
import { loadConn } from "../src/settings";
import { useTheme } from "../src/theme";
import { Text } from "../src/ui";

/** Búsqueda en las notas de los días. Cada resultado abre ese día. */
export default function Search() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const [api, setApi] = useState<Api | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  useEffect(() => void loadConn().then((conn) => conn && setApi(createApi(conn))), []);
  // 300 ms tras dejar de escribir: no se consulta al servidor en cada tecla.
  useEffect(() => {
    if (!api || q.trim().length < 2) return setHits(null);
    const id = setTimeout(() => api.search(q.trim()).then(setHits, () => setHits([])), 300);
    return () => clearTimeout(id);
  }, [q, api]);

  const open = async (h: SearchHit) => {
    if (!api) return;
    const m = await api.month(h.date.slice(0, 7)).catch(() => null);
    const ids = m?.days[h.date] ?? [];
    router.push({
      pathname: "/day",
      params: { date: h.date, ids: ids.join(","), videos: ids.filter((i) => m?.videos?.includes(i)).join(","), note: h.note },
    });
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={s.back}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("tabs.home")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("search.title")}
        </Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          accessibilityLabel={t("search.placeholder")}
          placeholder={t("search.placeholder")}
          placeholderTextColor={c.muted}
          returnKeyType="search"
          style={[s.input, { color: c.ink, borderColor: c.muted, backgroundColor: c.surface, fontFamily: "Geist_400Regular" }]}
        />
        {hits === null && <Text style={{ color: c.muted, marginTop: 12 }}>{t("search.hint")}</Text>}
        {hits?.length === 0 && <Text style={{ color: c.muted, marginTop: 12 }}>{t("search.none")}</Text>}
        <FlatList
          data={hits ?? []}
          keyExtractor={(h) => h.date}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: 12 }}
          renderItem={({ item: h }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => open(h)}
              style={({ pressed }) => [s.row, { borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] }]}
            >
              <View style={[s.thumb, { backgroundColor: c.surface }]}>
                {api && h.cover != null && (
                  <Image
                    source={api.thumbSource(h.cover)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="disk"
                    accessible={false}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {new Date(`${h.date}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })}
                </Text>
                <Text numberOfLines={2} style={{ color: c.ink, fontSize: 16 }}>
                  {h.note}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: 16, width: "100%", maxWidth: 720, alignSelf: "center" },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginVertical: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, paddingVertical: 10, borderBottomWidth: 1 },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: "hidden" },
});
