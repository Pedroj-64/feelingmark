import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "./theme";
import { Button, Text } from "./ui";

/** Pide un texto corto (nombre de un álbum). Alert.prompt solo existe en iOS, por eso es un modal propio. */
export function PromptModal({
  visible,
  title,
  initial = "",
  placeholder,
  confirm,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  confirm: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = useTheme();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);
  const ok = value.trim().length > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel={t("upload.close")} onPress={onClose} style={s.scrim}>
          <Pressable accessible={false} style={[s.sheet, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
              {title}
            </Text>
            <TextInput
              autoFocus
              value={value}
              onChangeText={setValue}
              maxLength={80}
              accessibilityLabel={title}
              placeholder={placeholder}
              placeholderTextColor={c.muted}
              returnKeyType="done"
              onSubmitEditing={() => ok && onSubmit(value.trim())}
              style={[s.input, { color: c.ink, borderColor: c.muted, backgroundColor: c.surface, fontFamily: "Geist_400Regular" }]}
            />
            <View style={s.row}>
              <Button kind="ghost" label={t("day.cancel")} onPress={onClose} style={{ flex: 1 }} />
              <Button label={confirm} disabled={!ok} onPress={() => onSubmit(value.trim())} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(22,19,15,0.45)", justifyContent: "center", padding: 24 },
  sheet: { borderRadius: 24, borderWidth: 1, padding: 20, width: "100%", maxWidth: 480, alignSelf: "center" },
  title: { fontSize: 22, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.3, marginBottom: 14 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
});
