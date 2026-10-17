import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import { createApi } from "../../src/api";
import { loadConn, saveConn } from "../../src/settings";
import { useTheme } from "../../src/theme";

export default function Settings() {
  const { t } = useTranslation();
  const c = useTheme();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<"idle" | "busy" | "ok" | "fail">("idle");

  useEffect(() => void loadConn().then((x) => x && (setUrl(x.url), setToken(x.token))), []);

  const input = [s.input, { color: c.ink, borderColor: c.muted, backgroundColor: c.surface }];
  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Image source={require("../../assets/icon.png")} style={s.logo} accessibilityIgnoresInvertColors />
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("settings.title")}
        </Text>
        <Text style={{ color: c.muted, marginBottom: 24 }}>{t("settings.hint")}</Text>
        {Platform.OS !== "web" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/scan")}
            style={({ pressed }) => [s.btn, { backgroundColor: c.accent, marginTop: 0, transform: [{ translateY: pressed ? 1 : 0 }] }]}
          >
            <Text style={{ color: c.onAccent, fontWeight: "600" }}>{t("scan.action")}</Text>
          </Pressable>
        )}
        <Text style={[s.label, { color: c.muted }]}>{t("settings.url")}</Text>
        <TextInput
          style={input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel={t("settings.url")}
          placeholder="http://192.168.1.10:8787"
          placeholderTextColor={c.muted}
        />
        <Text style={[s.label, { color: c.muted }]}>{t("settings.token")}</Text>
        <TextInput
          style={input}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          accessibilityLabel={t("settings.token")}
        />
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [s.btn, { backgroundColor: c.accent, transform: [{ translateY: pressed ? 1 : 0 }] }]}
          onPress={async () => {
            await saveConn({ url, token });
            setSaved(true);
          }}
        >
          <Text style={{ color: c.onAccent, fontWeight: "600" }}>{saved ? t("settings.saved") : t("settings.save")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={check === "busy"}
          style={({ pressed }) => [s.btn, s.ghost, { borderColor: c.muted, marginTop: 12, transform: [{ translateY: pressed ? 1 : 0 }] }]}
          onPress={() => {
            setCheck("busy");
            createApi({ url: url.trim().replace(/\/+$/, ""), token })
              .albums()
              .then(
                () => setCheck("ok"),
                () => setCheck("fail"),
              );
          }}
        >
          <Text style={{ color: c.accent, fontWeight: "600" }}>{t("settings.test")}</Text>
        </Pressable>
        {check !== "idle" && (
          <Text accessibilityLiveRegion="polite" style={{ color: check === "fail" ? c.accent : c.muted, marginTop: 8 }}>
            {t(`settings.test_${check}`)}
          </Text>
        )}
        <Text style={{ color: c.muted, marginTop: 32, fontSize: 13 }}>Feelingmark {Constants.expoConfig?.version ?? ""}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 16, marginBottom: 6 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  logo: { width: 56, height: 56, borderRadius: 14, marginTop: 8 },
  ghost: { borderWidth: 1 },
  btn: { marginTop: 24, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
