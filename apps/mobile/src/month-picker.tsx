import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import type { Api } from "./api";
import { useTheme } from "./theme";
import { Text } from "./ui";

/** Selector de año y mes: salta a cualquier mes sin pulsar la flecha decenas de veces. Marca los meses que tienen contenido. */
export function MonthPicker({
  visible,
  ym,
  api,
  onPick,
  onClose,
}: {
  visible: boolean;
  ym: string;
  api: Api | null;
  onPick: (ym: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const c = useTheme();
  const [year, setYear] = useState(+ym.slice(0, 4));
  const [withContent, setWithContent] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (visible) setYear(+ym.slice(0, 4));
  }, [visible, ym]);
  useEffect(() => {
    if (!visible || !api) return;
    api.albums().then(
      (a) => setWithContent(new Map(a.map((x) => [x.month, x.count]))),
      () => undefined,
    );
  }, [visible, api]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const name = new Date(`${key}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "short" });
    return { key, name: name.charAt(0).toUpperCase() + name.slice(1).replace(".", ""), count: withContent.get(key) ?? 0 };
  });
  const arrow = (d: number, label: string, Icon: typeof CaretLeft) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setYear(year + d)} hitSlop={8} style={s.arrow}>
      <Icon size={22} color={c.ink} />
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t("picker.close")} onPress={onClose} style={s.scrim}>
        <Pressable accessible={false} style={[s.sheet, { backgroundColor: c.bg, borderColor: c.line }]}>
          <View style={s.head}>
            {arrow(-1, t("picker.prevYear"), CaretLeft)}
            <Text accessibilityRole="header" style={[s.year, { color: c.ink }]}>
              {year}
            </Text>
            {arrow(1, t("picker.nextYear"), CaretRight)}
          </View>
          <View style={s.grid}>
            {months.map((m) => {
              const current = m.key === ym;
              return (
                <Pressable
                  key={m.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  accessibilityLabel={`${m.name} ${year}${m.count ? `, ${t("albums.count", { count: m.count })}` : ""}`}
                  onPress={() => (onPick(m.key), onClose())}
                  style={({ pressed }) => [
                    s.cell,
                    { backgroundColor: current ? c.accent : c.surface, borderColor: c.line, transform: [{ translateY: pressed ? 1 : 0 }] },
                  ]}
                >
                  <Text style={{ color: current ? c.onAccent : c.ink, fontWeight: "600", fontSize: 16 }}>{m.name}</Text>
                  <View style={[s.dot, { backgroundColor: m.count ? (current ? c.onAccent : c.accent) : "transparent" }]} />
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(22,19,15,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  year: { fontSize: 26, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: {
    width: "22.5%",
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
