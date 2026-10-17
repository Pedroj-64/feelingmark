import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { CalendarDots, GearSix, House, Images } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/theme";

export default function Layout() {
  const { t } = useTranslation();
  const c = useTheme();
  const { bottom } = useSafeAreaInsets(); // la barra de gestos del sistema no debe tapar las etiquetas
  const icon = (Icon: typeof House) =>
    function TabIcon({ focused }: { focused: boolean }) {
      return <Icon size={24} color={focused ? c.accent : c.muted} weight={focused ? "fill" : "regular"} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line, height: 62 + bottom, paddingBottom: 8 + bottom, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 12, fontFamily: "Geist_500Medium" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: icon(House) }} />
      <Tabs.Screen name="calendar" options={{ title: t("tabs.calendar"), tabBarIcon: icon(CalendarDots) }} />
      <Tabs.Screen name="albums" options={{ title: t("tabs.albums"), tabBarIcon: icon(Images) }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: icon(GearSix) }} />
    </Tabs>
  );
}
