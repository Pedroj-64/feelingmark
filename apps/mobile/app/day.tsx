import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { createApi, type Api } from "../src/api";
import { loadConn } from "../src/settings";
import { Text } from "../src/ui";
import { useTheme } from "../src/theme";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarBlank, Trash } from "phosphor-react-native";

export default function Day() {
  const {
    date,
    ids,
    videos: videoIds,
    note: initialNote,
  } = useLocalSearchParams<{ date: string; ids: string; videos?: string; note?: string }>();
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/calendar")); // al abrir la vista de día directamente (web) no hay historial
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
  const videoSet = new Set((videoIds ?? "").split(",").filter(Boolean).map(Number));
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.backToCalendar")}
        >
          <Text style={{ color: c.accent, fontWeight: "600" }}>‹ {t("tabs.calendar")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {title}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => save(note)}
          accessibilityLabel={t("a11y.noteField")}
          placeholder={t("day.notePlaceholder")}
          placeholderTextColor={c.muted}
          multiline
          maxLength={5000}
          style={[s.note, { color: c.ink, borderColor: noteErr ? c.accent : c.muted, backgroundColor: c.surface }]}
        />
        {noteErr && <Text style={{ color: c.accent, marginBottom: 12 }}>{t("common.error")}</Text>}
        <View style={{ gap: 20 }}>
          {api &&
            photos.map((id, i) => (
              <View key={id} style={{ gap: 8 }}>
                {videoSet.has(id) ? (
                  <VideoItem api={api} id={id} width={w} label={t("a11y.videoOf", { index: i + 1, total: photos.length })} />
                ) : (
                  <Photo api={api} id={id} width={w} label={t("a11y.photoOf", { index: i + 1, total: photos.length })} />
                )}
                <View style={s.actions}>
                  <MoveRow date={date} onMove={(d) => api.move(id, d).then(leave)} />
                  <DeleteButton
                    label={t("a11y.deleteItem", { index: i + 1, total: photos.length })}
                    onConfirmed={() =>
                      api.remove(id).then((orphaned) => {
                        if (orphaned) {
                          if (Platform.OS === "web") window.alert(t("day.orphaned"));
                          else Alert.alert(t("day.orphaned"));
                        }
                        leave();
                      })
                    }
                  />
                </View>
              </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  note: {
    fontFamily: "Geist_400Regular",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 88,
    fontSize: 16,
    marginBottom: 20,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  action: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, minHeight: 44, paddingHorizontal: 14 },
  action2: { flexDirection: "row", alignItems: "center", gap: 8 },
  root: { flex: 1 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 26, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginVertical: 12 },
});

/** Reproductor de un video del día. La URL firmada se pide al montar; caduca a los 10 min (basta para ver el clip). */
function VideoItem({ api, id, width, label }: { api: Api; id: number; width: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => void api.videoUrl(id).then(setSrc, () => setSrc(null)), [api, id]);
  const player = useVideoPlayer(src, () => {});
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel={label}
      style={{ width, height: width * 0.75, borderRadius: 16, backgroundColor: "#000" }}
    />
  );
}

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Mover un archivo a otro día con el selector nativo (diálogo en Android, compacto en iOS, <input type="date"> en web). */
function MoveRow({ date, onMove }: { date: string; onMove: (d: string) => Promise<void> }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState(new Date(`${date}T12:00:00`));
  const go = (d: string) => d !== date && onMove(d).catch(() => setMsg(t("common.error")));
  const btn = ({ pressed }: { pressed: boolean }) => [s.action, { borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] }];

  if (Platform.OS === "web")
    return (
      <View style={s.action2}>
        <CalendarBlank size={20} color={c.accent} />
        <input
          type="date"
          value={iso(picked)}
          aria-label={t("a11y.dateField")}
          onChange={(e) => e.target.value && go(e.target.value)}
          style={{ font: "inherit", border: 0, background: "transparent", color: c.ink, minHeight: 44 }}
        />
      </View>
    );
  if (Platform.OS === "ios")
    return (
      <View style={s.action2}>
        <DateTimePicker value={picked} mode="date" display="compact" accentColor={c.accent} onChange={(_, d) => d && setPicked(d)} />
        <Pressable accessibilityRole="button" onPress={() => go(iso(picked))} style={btn}>
          <Text style={{ color: c.accent, fontWeight: "600" }}>{t("day.move")}</Text>
        </Pressable>
      </View>
    );
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("a11y.dateField")}
        onPress={() =>
          DateTimePickerAndroid.open({
            value: picked,
            mode: "date",
            onChange: (e, d) => e.type === "set" && d && (setPicked(d), go(iso(d))),
          })
        }
        style={btn}
      >
        <CalendarBlank size={20} color={c.accent} />
        <Text style={{ color: c.accent, fontWeight: "600" }}>{t("day.move")}</Text>
      </Pressable>
      {msg !== "" && <Text style={{ color: c.muted }}>{msg}</Text>}
    </>
  );
}

/** Borrar es irreversible: pide confirmar (Alert en nativo, window.confirm en web, donde Alert no hace nada). */
function DeleteButton({ label, onConfirmed }: { label: string; onConfirmed: () => Promise<void> }) {
  const { t } = useTranslation();
  const c = useTheme();
  const [failed, setFailed] = useState(false);
  const run = () => onConfirmed().catch(() => setFailed(true));
  const ask = () => {
    if (Platform.OS === "web") {
      if (window.confirm(`${t("day.deleteTitle")}\n${t("day.deleteBody")}`)) void run();
      return;
    }
    Alert.alert(t("day.deleteTitle"), t("day.deleteBody"), [
      { text: t("day.cancel"), style: "cancel" },
      { text: t("day.delete"), style: "destructive", onPress: () => void run() },
    ]);
  };
  return (
    <View style={{ alignItems: "flex-start" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={ask}
        style={({ pressed }) => [s.action, { borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] }]}
      >
        <Trash size={20} color={c.accent} />
        <Text style={{ color: c.accent, fontWeight: "600" }}>{t("day.delete")}</Text>
      </Pressable>
      {failed && <Text style={{ color: c.muted }}>{t("common.error")}</Text>}
    </View>
  );
}

/** Foto a su proporción real (vertical u horizontal); 4:3 mientras carga. */
function Photo({ api, id, width, label }: { api: Api; id: number; width: number; label: string }) {
  const c = useTheme();
  const [ratio, setRatio] = useState(4 / 3);
  return (
    <Image
      source={api.fileSource(id)}
      style={{ width, aspectRatio: ratio, borderRadius: 16, backgroundColor: c.surface }}
      contentFit="cover"
      cachePolicy="disk"
      accessibilityLabel={label}
      onLoad={(e) => e.source.width > 0 && e.source.height > 0 && setRatio(Math.min(2.5, Math.max(0.4, e.source.width / e.source.height)))}
    />
  );
}
