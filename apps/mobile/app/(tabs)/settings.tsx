import Constants from "expo-constants";
import { getLocales } from "expo-localization";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Api, type Stats } from "../../src/api";
import { confirmAsk } from "../../src/confirm";
import { clearMarks } from "../../src/import-marks";
import { applyPrefs, DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "../../src/prefs";
import { queueStore } from "../../src/queue-store";
import { clearConn, loadConn, saveConn } from "../../src/settings";
import { useTheme } from "../../src/theme";
import { flushQueue } from "../../src/uploads";
import { Button, Segmented, Text } from "../../src/ui";

const REPO = "https://github.com/Pedroj-64/feelingmark";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [api, setApi] = useState<Api | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [check, setCheck] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [stats, setStats] = useState<Stats | null | "offline">(null);
  const [pending, setPending] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadConn().then((conn) => {
      setUrl(conn?.url ?? "");
      setToken(conn?.token ?? "");
      setEditing(!conn);
      if (!conn) return (setApi(null), setStats(null));
      const a = createApi(conn);
      setApi(a);
      a.stats().then(setStats, () => setStats("offline"));
    });
    queueStore.load().then((q) => setPending(q.length));
    loadPrefs().then(setPrefs);
  }, []);
  useFocusEffect(refresh);

  const setPref = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    void savePrefs(next);
    applyPrefs(next, getLocales()[0]?.languageCode ?? "en");
  };
  const flash = (m: string) => {
    setNote(m);
    setTimeout(() => setNote(null), 3000);
  };
  const date = (iso: string | null) =>
    iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" }) : "";
  const host = url.replace(/^https?:\/\//, "");

  const input = [s.input, { color: c.ink, borderColor: c.muted, backgroundColor: c.surface }];
  const section = (title: string) => (
    <Text accessibilityRole="header" style={[s.section, { color: c.muted }]}>
      {title}
    </Text>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("tabs.settings")}
        </Text>
        {note && (
          <Text accessibilityLiveRegion="polite" style={{ color: c.accent, marginBottom: 8 }}>
            {note}
          </Text>
        )}

        {section(t("settings.sectionServer"))}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontWeight: "600", fontSize: 16 }}>
            {!api ? t("settings.statusNone") : stats === "offline" ? t("settings.statusOff") : t("settings.statusOk", { host })}
          </Text>
          {stats && stats !== "offline" && (
            <>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {t("settings.library", { photos: stats.photos, videos: stats.videos, notes: stats.notes })}
              </Text>
              {stats.first && <Text style={{ color: c.muted }}>{t("settings.since", { date: date(stats.first) })}</Text>}
            </>
          )}
          {api && stats === null && <Text style={{ color: c.muted, marginTop: 4 }}>{t("settings.checking")}</Text>}
        </View>
        <View style={s.stack}>
          {Platform.OS !== "web" && <Button label={t("scan.action")} onPress={() => router.push("/scan")} />}
          <Button kind="ghost" label={editing ? t("settings.hideForm") : t("settings.edit")} onPress={() => setEditing((e) => !e)} />
        </View>
        {editing && (
          <View>
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
            <View style={s.stack}>
              <Button
                label={saved ? t("settings.saved") : t("settings.save")}
                onPress={async () => {
                  await saveConn({ url, token });
                  setSaved(true);
                  refresh();
                }}
              />
              <Button
                kind="ghost"
                label={t("settings.test")}
                disabled={check === "busy"}
                onPress={() => {
                  setCheck("busy");
                  createApi({ url: url.trim().replace(/\/+$/, ""), token })
                    .albums()
                    .then(
                      () => setCheck("ok"),
                      () => setCheck("fail"),
                    );
                }}
              />
            </View>
            {check !== "idle" && (
              <Text accessibilityLiveRegion="polite" style={{ color: check === "fail" ? c.accent : c.muted, marginTop: 8 }}>
                {t(`settings.test_${check}`)}
              </Text>
            )}
          </View>
        )}
        {api && (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (
                await confirmAsk(t("settings.disconnectTitle"), t("settings.disconnectBody"), t("settings.disconnect"), t("day.cancel"))
              ) {
                await clearConn();
                refresh();
              }
            }}
            style={s.link}
          >
            <Text style={{ color: c.accent, fontWeight: "600" }}>{t("settings.disconnect")}</Text>
          </Pressable>
        )}

        {section(t("settings.sectionLook"))}
        <Text style={[s.label, { color: c.muted }]}>{t("settings.theme")}</Text>
        <Segmented
          label={t("settings.theme")}
          value={prefs.theme}
          onChange={(theme) => setPref({ theme })}
          options={[
            { value: "system", label: t("settings.system") },
            { value: "light", label: t("settings.light") },
            { value: "dark", label: t("settings.dark") },
          ]}
        />
        <Text style={[s.label, { color: c.muted }]}>{t("settings.language")}</Text>
        <Segmented
          label={t("settings.language")}
          value={prefs.lang}
          onChange={(lang) => setPref({ lang })}
          options={[
            { value: "system", label: t("settings.system") },
            { value: "es", label: "Español" },
            { value: "en", label: "English" },
          ]}
        />

        {section(t("settings.sectionUploads"))}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={{ color: c.ink }}>{pending === 0 ? t("settings.queueNone") : t("settings.queueSome", { count: pending })}</Text>
        </View>
        <View style={s.stack}>
          {pending > 0 && api && (
            <Button
              kind="ghost"
              label={t("settings.queueRetry")}
              onPress={async () => {
                await flushQueue(api);
                refresh();
              }}
            />
          )}
          {pending > 0 && (
            <Button
              kind="ghost"
              label={t("settings.queueClear")}
              onPress={async () => {
                if (
                  await confirmAsk(t("settings.queueClearTitle"), t("settings.queueClearBody"), t("settings.queueClear"), t("day.cancel"))
                ) {
                  await queueStore.save([]);
                  refresh();
                }
              }}
            />
          )}
          {Platform.OS !== "web" && (
            <Button
              kind="ghost"
              label={t("settings.marksClear")}
              onPress={() => {
                clearMarks();
                flash(t("settings.marksDone"));
              }}
            />
          )}
        </View>

        {section(t("settings.sectionAbout"))}
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontWeight: "600" }}>Feelingmark {Constants.expoConfig?.version ?? ""}</Text>
          <Text style={{ color: c.muted, marginTop: 4 }}>{t("settings.hint")}</Text>
        </View>
        <View style={s.stack}>
          <Button kind="ghost" label={t("settings.source")} onPress={() => void Linking.openURL(REPO)} />
          <Button kind="ghost" label={t("settings.privacy")} onPress={() => void Linking.openURL(`${REPO}/blob/main/PRIVACY.md`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 48, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 16, marginBottom: 6 },
  section: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 28, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  stack: { gap: 10, marginTop: 12 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: { fontFamily: "Geist_400Regular", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  link: { minHeight: 44, justifyContent: "center", marginTop: 4 },
});
