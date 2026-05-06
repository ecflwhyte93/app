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
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../src/context/AuthContext";
import { C, R, SP } from "../src/theme";

export default function Register() {
  const { registerWithPhrase } = useAuth();
  const [step, setStep] = useState<"form" | "phrase">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phrase, setPhrase] = useState<string>("");
  const [acked, setAcked] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const out = await registerWithPhrase(email.trim(), password, name.trim());
      setPhrase(out.phrase);
      setStep("phrase");
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    if (!acked) {
      Alert.alert("Almost there", "Please confirm you've saved your recovery phrase.");
      return;
    }
    router.replace("/(tabs)/chats");
  };

  if (step === "phrase") {
    const words = phrase.split(/\s+/);
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.lockBadge}>
            <Feather name="key" size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>Save your recovery phrase</Text>
          <Text style={styles.subtitle}>
            These 24 words are the only way to recover your encrypted history if you forget your
            password or sign in from a new device. Write them down — Silent Signal cannot recover
            them for you.
          </Text>

          <View style={styles.phraseGrid} testID="recovery-phrase-grid">
            {words.map((w, i) => (
              <View key={`${i}-${w}`} style={styles.wordCell}>
                <Text style={styles.wordIndex}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={styles.wordText}>{w}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: SP.sm, marginTop: SP.md }}>
            <TouchableOpacity
              testID="copy-phrase"
              style={styles.ghostBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(phrase);
                Alert.alert("Copied", "Recovery phrase copied to clipboard");
              }}
            >
              <Feather name="copy" size={14} color={C.text} />
              <Text style={styles.ghostBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="ack-phrase"
            style={[styles.checkRow, acked && styles.checkRowOn]}
            onPress={() => setAcked((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, acked && styles.checkboxOn]}>
              {acked && <Feather name="check" size={12} color={C.bg} />}
            </View>
            <Text style={styles.checkText}>
              I've stored these 24 words somewhere safe and offline.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="finish-register"
            style={[styles.primaryBtn, !acked && { opacity: 0.5 }]}
            disabled={!acked}
            onPress={finish}
          >
            <Text style={styles.primaryBtnText}>Continue to Silent Signal</Text>
            <Feather name="arrow-right" size={16} color={C.bg} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            We'll generate a 24-word recovery phrase so a forgotten password never costs you your
            encrypted history.
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
    width: 40, height: 40, borderRadius: R.pill, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  lockBadge: {
    width: 56, height: 56, borderRadius: R.md, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center",
    marginTop: SP.lg,
  },
  title: { color: C.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.8, marginTop: SP.lg },
  subtitle: { color: C.mutedAlt, fontSize: 14, marginTop: 6, lineHeight: 20 },
  field: { marginTop: SP.lg },
  label: {
    color: C.muted, fontSize: 11, fontFamily: "monospace", letterSpacing: 1.5, marginBottom: SP.sm,
  },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md,
    paddingHorizontal: SP.md, paddingVertical: 14, color: C.text, fontSize: 15,
  },
  errorCard: {
    flexDirection: "row", alignItems: "center", gap: SP.sm,
    backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1, borderRadius: R.md, padding: SP.md, marginTop: SP.md,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm,
    backgroundColor: C.primary, borderRadius: R.pill, paddingVertical: 16, marginTop: SP.lg,
  },
  primaryBtnText: { color: C.bg, fontSize: 15, fontWeight: "700" },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: R.pill,
    paddingVertical: 12, paddingHorizontal: SP.lg,
  },
  ghostBtnText: { color: C.text, fontSize: 13, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: SP.xxl },
  footerText: { color: C.muted, fontSize: 14 },
  phraseGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SP.lg,
    backgroundColor: C.surface, padding: SP.md, borderRadius: R.md,
    borderWidth: 1, borderColor: "rgba(74,222,128,0.3)",
  },
  wordCell: {
    flexDirection: "row", alignItems: "center", gap: 6,
    width: "30%", minWidth: 100,
    backgroundColor: C.bg, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 10,
  },
  wordIndex: { color: C.muted, fontFamily: "monospace", fontSize: 10, width: 18 },
  wordText: { color: C.primary, fontFamily: "monospace", fontSize: 13, fontWeight: "600" },
  checkRow: {
    flexDirection: "row", alignItems: "center", gap: SP.sm,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: R.md, padding: SP.md, marginTop: SP.md,
  },
  checkRowOn: { borderColor: "rgba(74,222,128,0.5)" },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: C.muted,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  checkText: { color: C.text, fontSize: 13, flex: 1, lineHeight: 18 },
});
