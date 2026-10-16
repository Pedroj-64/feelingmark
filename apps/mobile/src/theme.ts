import { useColorScheme } from "react-native";

// Tokens de DESIGN.md
const light = {
  bg: "#F7F4EF",
  surface: "#FFFFFF",
  ink: "#1F1B16",
  muted: "#7A736A",
  line: "rgba(31,27,22,0.10)",
  accent: "#C4573A",
  onAccent: "#FFFFFF",
};
const dark = {
  bg: "#16130F",
  surface: "#211D18",
  ink: "#F2EDE4",
  muted: "#A39B8F",
  line: "rgba(242,237,228,0.12)",
  accent: "#E07A5C",
  onAccent: "#16130F",
};

export const useTheme = () => (useColorScheme() === "dark" ? dark : light);
export type Theme = ReturnType<typeof useTheme>;
