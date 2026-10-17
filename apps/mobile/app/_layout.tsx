import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, useFonts } from "@expo-google-fonts/geist";
import { Stack } from "expo-router";
import "../src/i18n";
import { useTheme } from "../src/theme";

export default function Layout() {
  const c = useTheme();
  // Fraunces: títulos; Geist: cuerpo. Si falla la carga se usa la fuente del sistema.
  const [loaded, error] = useFonts({ Fraunces_600SemiBold, Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  if (!loaded && !error) return null;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
