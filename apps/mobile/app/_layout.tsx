import { Stack } from "expo-router";
import "../src/i18n";
import { useTheme } from "../src/theme";

export default function Layout() {
  const c = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
