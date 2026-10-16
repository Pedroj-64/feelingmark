import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { saveConn } from "../src/settings";
import { useTheme } from "../src/theme";

/** Destino del QR de emparejamiento (feelingmark://connect?u=...&t=...). Pide confirmar: un QR ajeno podría apuntar a otro servidor. */
export default function Connect() {
  const { u, t: token } = useLocalSearchParams<{ u?: string; t?: string }>();
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const valid = typeof u === "string" && /^https?:\/\/[^\s/]+/i.test(u) && typeof token === "string" && token.length > 0;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Text style={[s.title, { color: c.ink }]}>{t("connect.title")}</Text>
        {valid ? (
          <>
            <Text style={{ color: c.muted, marginBottom: 8 }}>{t("connect.confirm")}</Text>
            <Text style={[s.url, { color: c.ink, borderColor: c.line, backgroundColor: c.surface }]}>{u}</Text>
            <Pressable
              onPress={async () => {
                await saveConn({ url: u, token });
                router.replace("/");
              }}
              style={({ pressed }) => [s.btn, { backgroundColor: c.accent, transform: [{ translateY: pressed ? 1 : 0 }] }]}
            >
              <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("connect.action")}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={{ color: c.muted }}>{t("connect.invalid")}</Text>
        )}
        <Pressable onPress={() => router.replace("/")} style={s.cancel}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>{t("connect.cancel")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontWeight: "600", letterSpacing: -0.5, marginTop: 24, marginBottom: 12 },
  url: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, overflow: "hidden" },
  btn: { marginTop: 24, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
