// IMPORTANT: Polyfill must be the first import — required for tweetnacl on
// React Native to use a CSPRNG via expo-crypto / native modules.
import "react-native-get-random-values";

import { useEffect, useState } from "react";
import { LogBox, View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Feather } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../src/context/AuthContext";
import { C } from "../src/theme";

// Keep splash visible until fonts are ready (silently fail on web where this is a no-op).
SplashScreen.preventAutoHideAsync().catch(() => {});

// Silence noisy upstream warnings we cannot fix from app code.
LogBox.ignoreLogs([
  "props.pointerEvents is deprecated",
  "style.resizeMode is deprecated",
]);

export default function RootLayout() {
  // Pre-load every icon font we use so iOS/Android Expo Go don't
  // race the asset loader and report "Font file for feather is empty".
  const [fontsLoaded, fontsError] = useFonts({
    ...Feather.font,
  });
  const [hidSplash, setHidSplash] = useState(false);

  useEffect(() => {
    if ((fontsLoaded || fontsError) && !hidSplash) {
      SplashScreen.hideAsync().catch(() => {});
      setHidSplash(true);
    }
  }, [fontsLoaded, fontsError, hidSplash]);

  if (!fontsLoaded && !fontsError) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

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
