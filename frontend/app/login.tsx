import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { C, R, SP } from "../src/theme";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/chats");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("alex@silent.app");
    setPassword("demo1234");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            testID="back-button"
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>

          <View style={styles.lockBadge}>
            <Feather name="lock" size={28} color={C.primary} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your encrypted channel.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@silent.app"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputRow}>
              <TextInput
                testID="password-input"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
              />
              <TouchableOpacity
                onPress={() => setShowPass((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={10}
              >
                <Feather
                  name={showPass ? "eye-off" : "eye"}
                  size={18}
                  color={C.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={styles.errorCard} testID="login-error">
              <Feather name="alert-triangle" size={14} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="login-submit"
            disabled={loading || !email || !password}
            onPress={submit}
            activeOpacity={0.85}
            style={[styles.primaryBtn, (loading || !email || !password) && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Sign in securely</Text>
                <Feather name="arrow-right" size={16} color={C.bg} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={fillDemo} style={{ marginTop: SP.md }}>
            <Text style={styles.demoLink} testID="demo-fill">
              Use demo: alex@silent.app
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="forgot-link"
            onPress={() => router.push("/forgot-password")}
            style={{ marginTop: SP.sm }}
          >
            <Text style={[styles.demoLink, { color: C.primary }]}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here?</Text>
            <TouchableOpacity testID="go-register" onPress={() => router.replace("/register")}>
              <Text style={[styles.footerText, { color: C.primary }]}> Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: SP.lg, paddingTop: SP.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.xl,
  },
  title: {
    color: C.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: SP.lg,
  },
  subtitle: { color: C.mutedAlt, fontSize: 14, marginTop: 6 },
  field: { marginTop: SP.lg },
  label: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginBottom: SP.sm,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingRight: SP.sm,
  },
  eyeBtn: { padding: SP.sm },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.md,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    backgroundColor: C.primary,
    borderRadius: R.pill,
    paddingVertical: 16,
    marginTop: SP.lg,
  },
  primaryBtnText: { color: C.bg, fontSize: 15, fontWeight: "700" },
  demoLink: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    fontFamily: "monospace",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SP.xxl,
  },
  footerText: { color: C.muted, fontSize: 14 },
});
