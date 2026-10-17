import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { parsePairing } from "../src/pair";
import { Text } from "../src/ui";
import { useTheme } from "../src/theme";

/** Escáner del QR que imprime el servidor (o muestra en /pair). Al leerlo pasa a la pantalla de confirmación. */
export default function Scan() {
  const { t } = useTranslation();
  const c = useTheme();
  const router = useRouter();
  const [perm, ask] = useCameraPermissions();
  const done = useRef(false);
  const [bad, setBad] = useState(false);

  const onScan = ({ data }: { data: string }) => {
    if (done.current) return;
    const p = parsePairing(data);
    if (!p) return setBad(true);
    done.current = true;
    router.replace({ pathname: "/connect", params: { u: p.url, ...(p.code ? { c: p.code } : { t: p.token }) } });
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <View style={s.body}>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {t("scan.title")}
        </Text>
        {perm?.granted ? (
          <>
            <CameraView
              style={s.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onScan}
              accessibilityLabel={t("scan.cameraLabel")}
            />
            <Text accessibilityLiveRegion="polite" style={{ color: bad ? c.accent : c.muted, marginTop: 12 }}>
              {bad ? t("scan.notFeelingmark") : t("scan.hint")}
            </Text>
          </>
        ) : perm ? (
          <>
            <Text style={{ color: c.muted, marginBottom: 16 }}>{t("scan.permission")}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => (perm.canAskAgain ? ask() : Linking.openSettings())}
              style={[s.btn, { backgroundColor: c.accent }]}
            >
              <Text style={{ color: c.onAccent, fontWeight: "600" }}>{perm.canAskAgain ? t("scan.allow") : t("scan.openSettings")}</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable onPress={() => router.back()} style={s.cancel} accessibilityRole="button">
          <Text style={{ color: c.accent, fontWeight: "600" }}>{t("connect.cancel")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, width: "100%", maxWidth: 520, alignSelf: "center" },
  title: { fontSize: 28, fontFamily: "Fraunces_600SemiBold", letterSpacing: -0.5, marginTop: 24, marginBottom: 16 },
  camera: { width: "100%", aspectRatio: 1, borderRadius: 16, overflow: "hidden" },
  btn: { borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
