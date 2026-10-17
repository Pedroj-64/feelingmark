import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type TextProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useTheme } from "./theme";

// Geist por peso (en Android cada peso es una familia distinta). Los títulos usan Fraunces y fijan su propia familia.
const FAMILY: Record<string, string> = {
  "400": "Geist_400Regular",
  "500": "Geist_500Medium",
  "600": "Geist_600SemiBold",
  "700": "Geist_600SemiBold",
};

/** Text con la fuente del cuerpo (Geist). Si el estilo ya trae fontFamily (Fraunces) se respeta. */
export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const family = flat.fontFamily ?? FAMILY[String(flat.fontWeight ?? "400")] ?? FAMILY["400"];
  // fontWeight se quita: con una familia por peso, Android lo aplicaría encima y deformaría el glifo
  return <RNText {...rest} style={[style, { fontFamily: family, fontWeight: undefined }]} />;
}

/** Marcador de carga con la forma del contenido final. Sin movimiento si el sistema pide reducirlo. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const v = useRef(new Animated.Value(0.55)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setStill)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [still, v]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ backgroundColor: c.line, opacity: still ? 0.7 : v, borderRadius: 12 }, style]}
    />
  );
}

/** Botón plano: primario (acento) o secundario (contorno). Mínimo 48 px, se hunde 1 px al pulsar. */
export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost";
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: 14,
          paddingHorizontal: 18,
          flexDirection: "row",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: primary ? c.accent : "transparent",
          borderWidth: primary ? 0 : 1,
          borderColor: c.line,
          opacity: disabled ? 0.4 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }, { scale: pressed ? 0.99 : 1 }],
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color: primary ? c.onAccent : c.accent, fontWeight: "600", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

/** Selector de 2 a 3 opciones, una activa. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 14,
        padding: 3,
        backgroundColor: c.surface,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? c.accent : "transparent",
            }}
          >
            <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "600" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
