import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { createApi, type Api } from "../src/api";
import { loadConn } from "../src/settings";
import { useTheme } from "../src/theme";

export default function Day() {
  const { date, ids } = useLocalSearchParams<{ date: string; ids: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  useEffect(() => void loadConn().then((conn) => conn && setApi(createApi(conn))), []);

  const photos = (ids ?? "").split(",").filter(Boolean).map(Number);
  const title = new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const w = Math.min(width, 720) - 32;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("tabs.calendar")}</Text>
        </Pressable>
        <Text style={[s.title, { color: c.ink }]}>{title}</Text>
        <View style={{ gap: 12 }}>
          {api && photos.map((id) => (
            <Image key={id} source={api.fileSource(id)} style={{ width: w, height: w * 0.75, borderRadius: 16, backgroundColor: c.surface }} contentFit="cover" />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 26, fontWeight: "600", letterSpacing: -0.5, marginVertical: 12, textTransform: "capitalize" },
});
