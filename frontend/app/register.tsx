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

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)/chats");
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            testID="back-button"
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>

          <View style={styles.lockBadge}>
            <Feather name="user-plus" size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>Create your channel</Text>
          <Text style={styles.subtitle}>
            Pick a display name. We never ask for more than necessary.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>DISPLAY NAME</Text>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Alex"
              placeholderTextColor={C.muted}
              autoCapitalize="words"
              style={styles.input}
            />
          </View>
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
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={C.muted}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          {error && (
            <View style={styles.errorCard} testID="register-error">
              <Feather name="alert-triangle" size={14} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="register-submit"
            disabled={loading || !email || !password || !name}
            onPress={submit}
            activeOpacity={0.85}
            style={[
              styles.primaryBtn,
              (loading || !email || !password || !name) && { opacity: 0.5 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Create account</Text>
                <Feather name="arrow-right" size={16} color={C.bg} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have one?</Text>
            <TouchableOpacity testID="go-login" onPress={() => router.replace("/login")}>
              <Text style={[styles.footerText, { color: C.primary }]}> Sign in</Text>
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
  title: { color: C.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.8, marginTop: SP.lg },
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: SP.xxl },
  footerText: { color: C.muted, fontSize: 14 },
});
