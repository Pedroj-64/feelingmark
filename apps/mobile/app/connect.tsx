import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { redeem } from "../src/pair";
import { saveConn } from "../src/settings";
import { Text } from "../src/ui";
import { useTheme } from "../src/theme";

/** Destino del QR de emparejamiento (feelingmark://connect?u=...&t=...). Pide confirmar: un QR ajeno podría apuntar a otro servidor. */
export default function Connect() {
  const { u, t: token, c: code } = useLocalSearchParams<{ u?: string; t?: string; c?: string }>();
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const valid = typeof u === "string" && /^https?:\/\/[^\s/]+/i.test(u) && (Boolean(token) || Boolean(code));

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("connect.title")}
        </Text>
        {valid ? (
          <>
            <Text style={{ color: c.muted, marginBottom: 8 }}>{t("connect.confirm")}</Text>
            <Text style={[s.url, { color: c.ink, borderColor: c.line, backgroundColor: c.surface }]}>{u}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                try {
                  await saveConn({ url: u, token: token || (await redeem(u, String(code))) });
                  router.replace("/");
                } catch {
                  setFailed(true); // código usado o caducado, o el servidor no responde
                }
              }}
              style={({ pressed }) => [s.btn, { backgroundColor: c.accent, transform: [{ translateY: pressed ? 1 : 0 }] }]}
            >
              <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("connect.action")}</Text>
            </Pressable>
            {failed && <Text style={{ color: c.accent, marginTop: 12 }}>{t("connect.expired")}</Text>}
          </>
        ) : (
          <Text style={{ color: c.muted }}>{t("connect.invalid")}</Text>
        )}
        <Pressable onPress={() => router.replace("/")} style={s.cancel} accessibilityRole="button">
          <Text style={{ color: c.accent, fontWeight: "600" }}>{t("connect.cancel")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 24, marginBottom: 12 },
  url: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, overflow: "hidden" },
  btn: { marginTop: 24, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
