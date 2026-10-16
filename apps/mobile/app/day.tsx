import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Api } from "../src/api";
import { loadConn } from "../src/settings";
import { useTheme } from "../src/theme";

export default function Day() {
  const { date, ids, note: initialNote } = useLocalSearchParams<{ date: string; ids: string; note?: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [api, setApi] = useState<Api | null>(null);
  const [note, setNote] = useState(initialNote ?? "");
  const [noteErr, setNoteErr] = useState(false);
  // Autoguardado: 700 ms tras dejar de escribir, y al salir de la pantalla (onBlur no se dispara al volver atrás).
  const saved = useRef(initialNote ?? "");
  const latest = useRef(note);
  latest.current = note;
  const save = (n: string) => {
    if (!api || n === saved.current) return;
    saved.current = n;
    api.saveNote(date, n).then(
      () => setNoteErr(false),
      () => ((saved.current = "\u0000"), setNoteErr(true)),
    );
  };
  useEffect(() => {
    const id = setTimeout(() => save(note), 700);
    return () => clearTimeout(id);
  }, [note, api]);
  useEffect(() => () => save(latest.current), [api]);
  useEffect(() => void loadConn().then((conn) => conn && setApi(createApi(conn))), []);

  const photos = (ids ?? "").split(",").filter(Boolean).map(Number);
  const rawTitle = new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const w = Math.min(width, 720) - 32;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ width: Math.min(width, 720), alignSelf: "center", padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("tabs.calendar")}</Text>
        </Pressable>
        <Text style={[s.title, { color: c.ink }]}>{title}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => save(note)}
          placeholder={t("day.notePlaceholder")}
          placeholderTextColor={c.muted}
          multiline
          maxLength={5000}
          style={[s.note, { color: c.ink, borderColor: noteErr ? c.accent : c.line, backgroundColor: c.surface }]}
        />
        {noteErr && <Text style={{ color: c.accent, marginBottom: 12 }}>{t("common.error")}</Text>}
        <View style={{ gap: 20 }}>
          {api &&
            photos.map((id) => (
              <View key={id} style={{ gap: 8 }}>
                <Image
                  source={api.fileSource(id)}
                  style={{ width: w, height: w * 0.75, borderRadius: 16, backgroundColor: c.surface }}
                  contentFit="cover"
                />
                <MoveRow date={date} onMove={(d) => api.move(id, d).then(() => router.back())} />
              </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  note: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 88, fontSize: 16, marginBottom: 20, textAlignVertical: "top" },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  moveBtn: { borderWidth: 1, borderRadius: 14, minHeight: 48, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  root: { flex: 1 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 26, fontWeight: "600", letterSpacing: -0.5, marginVertical: 12 },
});

function MoveRow({ date, onMove }: { date: string; onMove: (d: string) => Promise<void> }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [v, setV] = useState(date);
  const [msg, setMsg] = useState("");
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={v}
          onChangeText={setV}
          autoCapitalize="none"
          style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.surface }]}
        />
        <Pressable
          onPress={() => (ok ? onMove(v).catch(() => setMsg(t("common.error"))) : setMsg(t("day.invalid")))}
          style={({ pressed }) => [s.moveBtn, { borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] }]}
        >
          <Text style={{ color: c.accent, fontWeight: "600" }}>{t("day.move")}</Text>
        </Pressable>
      </View>
      {msg !== "" && <Text style={{ color: c.muted, marginTop: 4 }}>{msg}</Text>}
    </View>
  );
}
