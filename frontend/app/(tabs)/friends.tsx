import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/lib/api";
import { C, R, SP } from "../../src/theme";

type Friend = {
  id: string;
  status: "pending" | "accepted" | "declined";
  isRequester: boolean;
  otherUser: { id: string; name: string; email: string; phone: string | null };
};

type SearchUser = { id: string; name: string; email: string; phone: string | null };

export default function FriendsTab() {
  const [items, setItems] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: Friend[] }>("/friends/list");
      setItems(data.items);
    } catch (e: any) {
      console.warn("friends load", e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const incoming = items.filter((f) => f.status === "pending" && !f.isRequester);
  const outgoing = items.filter((f) => f.status === "pending" && f.isRequester);
  const accepted = items.filter((f) => f.status === "accepted");

  const accept = async (id: string) => {
    try {
      await api("/friends/accept", { method: "POST", body: { friendId: id } });
      load();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Try again");
    }
  };
  const decline = async (id: string) => {
    try {
      await api("/friends/decline", { method: "POST", body: { friendId: id } });
      load();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Try again");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          testID="add-friend-btn"
          onPress={() => setShowAdd(true)}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Feather name="user-plus" size={18} color={C.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xl }}
          data={[
            { type: "section", key: "incoming", title: `INBOX · ${incoming.length}` },
            ...incoming.map((f) => ({ type: "incoming", key: f.id, friend: f })),
            { type: "section", key: "accepted", title: `FRIENDS · ${accepted.length}` },
            ...accepted.map((f) => ({ type: "accepted", key: f.id, friend: f })),
            { type: "section", key: "outgoing", title: `SENT · ${outgoing.length}` },
            ...outgoing.map((f) => ({ type: "outgoing", key: f.id, friend: f })),
          ]}
          keyExtractor={(it: any) => it.key}
          renderItem={({ item }: any) => {
            if (item.type === "section") {
              return <Text style={styles.sectionLabel}>{item.title}</Text>;
            }
            const f: Friend = item.friend;
            const initial = (f.otherUser.name?.[0] || "?").toUpperCase();
            return (
              <View style={styles.card} testID={`friend-row-${f.id}`}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {f.otherUser.name || "Unknown"}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {f.otherUser.email}
                  </Text>
                </View>
                {item.type === "incoming" && (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity
                      testID={`accept-${f.id}`}
                      style={styles.acceptBtn}
                      onPress={() => accept(f.id)}
                    >
                      <Feather name="check" size={14} color={C.bg} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`decline-${f.id}`}
                      style={styles.declineBtn}
                      onPress={() => decline(f.id)}
                    >
                      <Feather name="x" size={14} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                )}
                {item.type === "accepted" && <View style={styles.onlineDot} />}
                {item.type === "outgoing" && <Text style={styles.pendingText}>PENDING</Text>}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="users" size={26} color={C.primary} />
              </View>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyDesc}>
                Add people by name, email, or phone. Once they accept, an encrypted DM appears in
                your chats.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowAdd(true)}>
                <Feather name="user-plus" size={14} color={C.bg} />
                <Text style={styles.primaryBtnText}>Add a friend</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <AddFriendModal visible={showAdd} onClose={() => setShowAdd(false)} onSent={load} />
    </SafeAreaView>
  );
}

function AddFriendModal({
  visible,
  onClose,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setQ("");
      setResults([]);
      setSentTo(new Set());
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api<{ results: SearchUser[] }>(
          `/friends/search?q=${encodeURIComponent(q.trim())}`
        );
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, visible]);

  const sendRequest = async (uid: string) => {
    try {
      await api("/friends/request", { method: "POST", body: { addresseeId: uid } });
      setSentTo((prev) => new Set(prev).add(uid));
      onSent();
    } catch (e: any) {
      Alert.alert("Cannot add", e?.message || "Try again");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add friend</Text>
          <Text style={styles.sheetSub}>Search by display name, email, or phone number.</Text>

          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={C.muted} />
            <TextInput
              testID="add-friend-search"
              value={q}
              onChangeText={setQ}
              placeholder="alex, +1555..., @silent.app"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
              autoFocus
            />
          </View>

          <View style={{ minHeight: 200 }}>
            {loading && (
              <View style={{ paddingVertical: SP.lg, alignItems: "center" }}>
                <ActivityIndicator color={C.primary} />
              </View>
            )}
            {!loading && q.trim() !== "" && results.length === 0 && (
              <Text style={styles.noResults}>No users found</Text>
            )}
            {results.map((u) => (
              <View key={u.id} style={styles.resultRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(u.name?.[0] || "?").toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {u.name || "Unknown"}
                  </Text>
                  <Text style={styles.email} numberOfLines={1}>
                    {u.email}
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`send-request-${u.id}`}
                  disabled={sentTo.has(u.id)}
                  style={[styles.acceptBtn, sentTo.has(u.id) && { opacity: 0.5 }]}
                  onPress={() => sendRequest(u.id)}
                >
                  <Feather name={sentTo.has(u.id) ? "check" : "user-plus"} size={14} color={C.bg} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
  },
  title: { color: C.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginTop: SP.lg,
    marginBottom: SP.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: SP.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: "rgba(74,222,128,0.12)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  name: { color: C.text, fontSize: 15, fontWeight: "600" },
  email: { color: C.muted, fontSize: 12, marginTop: 2 },
  acceptBtn: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  pendingText: {
    color: C.muted,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1.5,
  },
  empty: { alignItems: "center", padding: SP.xl, marginTop: SP.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: R.pill,
    backgroundColor: "rgba(74,222,128,0.08)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "600", marginTop: SP.lg },
  emptyDesc: {
    color: C.mutedAlt,
    fontSize: 13,
    textAlign: "center",
    marginTop: SP.sm,
    maxWidth: 320,
    lineHeight: 19,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: R.pill,
    paddingVertical: 14,
    paddingHorizontal: SP.lg,
    marginTop: SP.lg,
  },
  primaryBtnText: { color: C.bg, fontSize: 14, fontWeight: "700" },

  // Modal
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: C.border,
    padding: SP.lg,
    paddingBottom: SP.xxl,
    maxHeight: "85%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginBottom: SP.md,
  },
  sheetTitle: { color: C.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  sheetSub: { color: C.mutedAlt, fontSize: 13, marginTop: 4, marginBottom: SP.lg },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
  },
  searchInput: { flex: 1, color: C.text, paddingVertical: 14, fontSize: 15 },
  noResults: { color: C.muted, fontSize: 13, textAlign: "center", paddingVertical: SP.lg },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    paddingVertical: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
});
