import { useColorScheme } from "react-native";
import { dark, light } from "./colors";

export const useTheme = () => (useColorScheme() === "dark" ? dark : light);
export type Theme = ReturnType<typeof useTheme>;
