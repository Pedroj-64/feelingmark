import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme";

export default function Layout() {
  const { t } = useTranslation();
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line, height: 64, paddingBottom: 10, paddingTop: 6 },
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.calendar") }} />
      <Tabs.Screen name="albums" options={{ title: t("tabs.albums") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings") }} />
    </Tabs>
  );
}
