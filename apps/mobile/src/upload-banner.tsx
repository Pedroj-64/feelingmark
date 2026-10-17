import { useEffect, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { dismissUploads, getUploadState, subscribeUploads } from "./uploads";
import { useTheme } from "./theme";
import { Text } from "./ui";

/** Aviso flotante de subidas, visible en cualquier pantalla: preparando, "3 de 12" con barra y el resultado. */
export function UploadBanner() {
  const { t } = useTranslation();
  const c = useTheme();
  const { top } = useSafeAreaInsets();
  const u = useSyncExternalStore(subscribeUploads, getUploadState);
  const clean = u.phase === "done" && u.dropped === 0 && u.left === 0;
  // Si todo salió bien se quita solo; si hubo fallos se queda hasta que se cierre.
  useEffect(() => {
    if (!clean) return;
    const id = setTimeout(dismissUploads, 3500);
    return () => clearTimeout(id);
  }, [clean]);
  if (u.phase === "idle") return null;

  const pct = u.phase === "uploading" ? Math.max(4, (u.done / Math.max(1, u.total)) * 100) : u.phase === "done" ? 100 : 12;
  const text =
    u.phase === "preparing"
      ? t("upload.preparing")
      : u.phase === "uploading"
        ? t("upload.progress", { done: Math.min(u.done + 1, u.total), total: u.total })
        : [
            t("upload.done", { count: u.done }),
            u.dropped > 0 ? t("upload.failed", { count: u.dropped }) : null,
            u.left > 0 ? t("upload.pending", { count: u.left }) : null,
          ]
            .filter(Boolean)
            .join(" · ");
  return (
    <View pointerEvents="box-none" style={[s.wrap, { top: top + 8 }]}>
      <View accessibilityLiveRegion="polite" style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontWeight: "600" }}>{text}</Text>
          <View style={[s.track, { backgroundColor: c.line }]}>
            <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: u.dropped > 0 ? c.muted : c.accent }} />
          </View>
        </View>
        {u.phase === "done" && !clean && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("upload.close")}
            onPress={dismissUploads}
            hitSlop={12}
            style={s.close}
          >
            <Text style={{ color: c.accent, fontWeight: "600" }}>{t("upload.close")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#1F1B16",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  track: { height: 4, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  close: { minHeight: 44, justifyContent: "center" },
});
