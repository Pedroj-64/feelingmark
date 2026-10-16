import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import "../src/i18n";
import { useTheme } from "../src/theme";

export default function Layout() {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.calendar") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings") }} />
    </Tabs>
  );
}
