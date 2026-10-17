import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from "@expo-google-fonts/geist";
import { getLocales } from "expo-localization";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { UploadBanner } from "../src/upload-banner";
import "../src/i18n";
import { applyPrefs, loadPrefs } from "../src/prefs";
import { useTheme } from "../src/theme";

export default function Layout() {
  const c = useTheme();
  // Fraunces: títulos; Geist: cuerpo. Si falla la carga se usa la fuente del sistema.
  useEffect(() => void loadPrefs().then((p) => applyPrefs(p, getLocales()[0]?.languageCode ?? "en")), []);
  const [loaded, error] = useFonts({ Fraunces_600SemiBold, Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  if (!loaded && !error) return null;
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
      <UploadBanner />
    </View>
  );
}
