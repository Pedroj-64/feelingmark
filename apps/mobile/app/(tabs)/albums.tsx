import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Album, type Api } from "../../src/api";
import { loadConn } from "../../src/settings";
import { useTheme } from "../../src/theme";

/** Un álbum por mes con fotos, creado solo a partir de las fechas. */
export default function Albums() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadConn().then(async (conn) => {
        if (!conn) return setError(true);
        const a = createApi(conn);
        setApi(a);
        try {
          setAlbums(await a.albums());
          setError(false);
        } catch {
          setError(true);
        }
      });
    }, []),
  );

  const gap = 12;
  const card = (Math.min(width, 720) - 16 * 2 - gap) / 2;
  const label = (month: string) => {
    const d = new Date(`${month}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
    return d.charAt(0).toUpperCase() + d.slice(1);
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", padding: 16, paddingBottom: 32 }}>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("tabs.albums")}
        </Text>
        {error && <Text style={{ color: c.muted, marginBottom: 12 }}>{t("calendar.offline")}</Text>}
        {albums && albums.length === 0 && <Text style={{ color: c.muted }}>{t("albums.empty")}</Text>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
          {albums?.map((al) => (
            <Pressable
              key={al.month}
              accessibilityRole="button"
              accessibilityLabel={`${label(al.month)}, ${t("albums.count", { count: al.count })}`}
              onPress={() => router.navigate({ pathname: "/", params: { month: al.month } })}
              style={({ pressed }) => [{ width: card, transform: [{ translateY: pressed ? 1 : 0 }] }]}
            >
              <View style={[s.cover, { width: card, height: card, backgroundColor: c.surface }]}>
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
              <Text style={[s.name, { color: c.ink }]}>{label(al.month)}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{t("albums.count", { count: al.count })}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 16, marginBottom: 16 },
  cover: { borderRadius: 16, overflow: "hidden" },
  name: { fontSize: 16, fontWeight: "600", marginTop: 8 },
});
