import { Alert, Platform } from "react-native";

/** Pregunta sí/no (Alert en nativo, window.confirm en web, donde Alert no hace nada). */
export function confirmAsk(title: string, body: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n${body}`));
  return new Promise((resolve) =>
    Alert.alert(
      title,
      body,
      [
        { text: cancel, style: "cancel", onPress: () => resolve(false) },
        { text: ok, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
