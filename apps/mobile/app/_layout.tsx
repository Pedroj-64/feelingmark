import { Fraunces_600SemiBold, useFonts } from "@expo-google-fonts/fraunces";
import { Stack } from "expo-router";
import "../src/i18n";
import { useTheme } from "../src/theme";

export default function Layout() {
  const c = useTheme();
  const [loaded, error] = useFonts({ Fraunces_600SemiBold }); // títulos; si falla la carga se usa la fuente del sistema
  if (!loaded && !error) return null;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
