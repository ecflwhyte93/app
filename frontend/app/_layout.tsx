// IMPORTANT: Polyfill must be the first import — required for tweetnacl on
// React Native to use a CSPRNG via expo-crypto / native modules.
import "react-native-get-random-values";

import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { C } from "../src/theme";

// Silence noisy upstream warnings we cannot fix from app code.
//   - `props.pointerEvents is deprecated` comes from @react-navigation/* and
//     react-native-web internals; it's harmless and will be resolved by an
//     upstream library update.
LogBox.ignoreLogs([
  "props.pointerEvents is deprecated",
  "style.resizeMode is deprecated",
]);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
            animation: "fade",
          }}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
