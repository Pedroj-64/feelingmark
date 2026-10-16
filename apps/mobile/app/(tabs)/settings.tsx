import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { loadConn, saveConn } from "../../src/settings";
import { useTheme } from "../../src/theme";

export default function Settings() {
  const { t } = useTranslation();
  const c = useTheme();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => void loadConn().then((x) => x && (setUrl(x.url), setToken(x.token))), []);

  const input = [s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.surface }];
  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Text style={[s.title, { color: c.ink }]}>{t("settings.title")}</Text>
        <Text style={{ color: c.muted, marginBottom: 24 }}>{t("settings.hint")}</Text>
        <Text style={[s.label, { color: c.muted }]}>{t("settings.url")}</Text>
        <TextInput
          style={input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.10:8787"
          placeholderTextColor={c.muted}
        />
        <Text style={[s.label, { color: c.muted }]}>{t("settings.token")}</Text>
        <TextInput style={input} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Pressable
          style={({ pressed }) => [s.btn, { backgroundColor: c.accent, transform: [{ translateY: pressed ? 1 : 0 }] }]}
          onPress={async () => {
            await saveConn({ url, token });
            setSaved(true);
          }}
        >
          <Text style={{ color: c.onAccent, fontWeight: "600" }}>{saved ? t("settings.saved") : t("settings.save")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontWeight: "600", letterSpacing: -0.5, marginTop: 24, marginBottom: 6 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  btn: { marginTop: 24, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
