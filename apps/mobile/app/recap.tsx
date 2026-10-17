import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi } from "../src/api";
import { loadConn } from "../src/settings";
import { useTheme } from "../src/theme";
import { Button, Text } from "../src/ui";

/** Resumen en video del mes, dentro de la app. El servidor lo genera la primera vez (puede tardar) y lo guarda. */
export default function Recap() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    setFailed(false);
    setReady(false);
    try {
      const conn = await loadConn();
      if (!conn) throw new Error("no server");
      const url = await createApi(conn).recapUrl(month);
      // El servidor responde cuando el video está hecho: se comprueba antes para poder mostrar el error en vez de un reproductor mudo.
      const head = await fetch(url, { headers: { range: "bytes=0-0" } });
      if (!head.ok) throw new Error(`HTTP ${head.status}`);
      setSrc(url);
    } catch {
      setFailed(true);
    }
  }, [month]);
  useEffect(() => void start(), [start]);

  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener("statusChange", ({ status }) => status === "readyToPlay" && setReady(true));
    return () => sub.remove();
  }, [player]);

  const raw = new Date(`${month}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  const w = Math.min(width, 720) - 32;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={s.back}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("tabs.home")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {raw.charAt(0).toUpperCase() + raw.slice(1)}
        </Text>
        {failed ? (
          <>
            <Text style={{ color: c.muted, marginBottom: 16 }}>{t("recap.error")}</Text>
            <Button label={t("recap.retry")} onPress={start} />
          </>
        ) : (
          <View style={{ width: w, height: w * 1.1, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" }}>
            {src && (
              <VideoView
                player={player}
                nativeControls
                contentFit="contain"
                accessibilityLabel={t("recap.title")}
                style={StyleSheet.absoluteFill}
              />
            )}
            {!ready && (
              <View style={[StyleSheet.absoluteFill, s.loading]}>
                <ActivityIndicator color="#fff" />
                <Text style={{ color: "#fff", textAlign: "center", marginTop: 12, paddingHorizontal: 24 }}>{t("recap.loading")}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: 16, width: "100%", maxWidth: 720, alignSelf: "center" },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginVertical: 12 },
  loading: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
});
