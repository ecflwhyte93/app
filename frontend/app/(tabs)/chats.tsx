import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { api } from "../../src/lib/api";
import { C, R, SP } from "../../src/theme";

type Room = {
  id: string;
  name: string;
  type: "dm" | "group";
  inviteCode: string | null;
  memberCount: number;
  lastMessage: { senderName: string; createdAt: string; ephemeral: boolean } | null;
  createdAt: string;
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatsTab() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: Room[] }>("/rooms");
      setRooms(data.items);
    } catch (e: any) {
      console.warn("rooms load", e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.lockBadge}>
            <Feather name="lock" size={14} color={C.primary} />
          </View>
          <Text style={styles.brand}>Silent Signal</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="join-room-btn"
            style={styles.iconBtn}
            onPress={() => setShowJoin(true)}
            hitSlop={8}
          >
            <Feather name="hash" size={18} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="create-room-btn"
            style={styles.iconBtn}
            onPress={() => setShowCreate(true)}
            hitSlop={8}
          >
            <Feather name="plus" size={18} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.privacyBar}>
        <Feather name="shield" size={12} color={C.primary} />
        <Text style={styles.privacyText}>END-TO-END ENCRYPTED · ZERO KNOWLEDGE</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : rooms.length === 0 ? (
        <EmptyState onCreate={() => setShowCreate(true)} onJoin={() => setShowJoin(true)} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={C.primary}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => <RoomRow room={item} />}
          ItemSeparatorComponent={() => <View style={{ height: SP.sm }} />}
        />
      )}

      <CreateRoomModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      <JoinRoomModal visible={showJoin} onClose={() => setShowJoin(false)} onJoined={load} />
    </SafeAreaView>
  );
}

function RoomRow({ room }: { room: Room }) {
  const initial = (room.name?.[0] || "?").toUpperCase();
  return (
    <TouchableOpacity
      testID={`room-row-${room.id}`}
      activeOpacity={0.7}
      style={styles.roomRow}
      onPress={() => router.push(`/chat/${room.id}`)}
    >
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: room.type === "group" ? "rgba(74,222,128,0.12)" : C.surface,
            borderColor: room.type === "group" ? "rgba(74,222,128,0.4)" : C.border,
          },
        ]}
      >
        {room.type === "group" ? (
          <Feather name="users" size={18} color={C.primary} />
        ) : (
          <Text style={styles.avatarText}>{initial}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.roomTopRow}>
          <Text style={styles.roomName} numberOfLines={1}>
            {room.name}
          </Text>
          {room.lastMessage && (
            <Text style={styles.roomTime}>{formatTime(room.lastMessage.createdAt)}</Text>
          )}
        </View>
        <View style={styles.roomBottomRow}>
          <Feather name="lock" size={11} color={C.muted} />
          <Text style={styles.roomPreview} numberOfLines={1}>
            {room.lastMessage
              ? room.type === "group"
                ? `${room.lastMessage.senderName}: [encrypted]`
                : "[encrypted]"
              : room.type === "group"
                ? `${room.memberCount} members`
                : "Tap to send your first message"}
          </Text>
          {room.lastMessage?.ephemeral && (
            <View style={styles.vanishPill}>
              <Feather name="eye-off" size={9} color={C.primary} />
              <Text style={styles.vanishText}>VANISH</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name="message-circle" size={28} color={C.primary} />
      </View>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptyDesc}>
        Add friends from the Friends tab, create a private group, or join one with an invite code.
      </Text>
      <View style={{ flexDirection: "row", gap: SP.sm, marginTop: SP.lg }}>
        <TouchableOpacity testID="empty-create-btn" style={styles.primaryBtn} onPress={onCreate}>
          <Feather name="plus" size={14} color={C.bg} />
          <Text style={styles.primaryBtnText}>New group</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="empty-join-btn" style={styles.ghostBtn} onPress={onJoin}>
          <Feather name="hash" size={14} color={C.text} />
          <Text style={styles.ghostBtnText}>Join by code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CreateRoomModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ id: string; inviteCode: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const data = await api<{ id: string; inviteCode: string }>("/rooms", {
        method: "POST",
        body: { name: name.trim() },
      });
      setCreated(data);
      onCreated();
    } catch (e: any) {
      Alert.alert("Could not create room", e?.message || "Try again");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setName("");
    setCreated(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Create group</Text>
          <Text style={styles.sheetSub}>
            Generate a private invite code. Only people you share it with can join.
          </Text>

          {!created ? (
            <>
              <Text style={styles.label}>GROUP NAME</Text>
              <TextInput
                testID="create-room-name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Operations team"
                placeholderTextColor={C.muted}
                style={styles.input}
                autoFocus
              />
              <TouchableOpacity
                testID="create-room-submit"
                style={[styles.primaryBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
                disabled={!name.trim() || loading}
                onPress={submit}
              >
                {loading ? (
                  <ActivityIndicator color={C.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create encrypted room</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeText} testID="created-invite-code">
                {created.inviteCode}
              </Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(created.inviteCode);
                  Alert.alert("Copied", "Invite code copied to clipboard");
                }}
              >
                <Feather name="copy" size={14} color={C.primary} />
                <Text style={styles.copyText}>Copy code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: SP.md }]}
                onPress={() => {
                  const id = created.id;
                  close();
                  router.push(`/chat/${id}`);
                }}
              >
                <Text style={styles.primaryBtnText}>Open room</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function JoinRoomModal({
  visible,
  onClose,
  onJoined,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const data = await api<{ id: string }>("/rooms/join", {
        method: "POST",
        body: { inviteCode: code.trim() },
      });
      onJoined();
      setCode("");
      onClose();
      router.push(`/chat/${data.id}`);
    } catch (e: any) {
      Alert.alert("Cannot join", e?.message || "Invalid invite code");
    } finally {
      setLoading(false);
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
          <Text style={styles.sheetTitle}>Join a room</Text>
          <Text style={styles.sheetSub}>Paste the invite code shared by a room member.</Text>
          <Text style={styles.label}>INVITE CODE</Text>
          <TextInput
            testID="join-room-code"
            value={code}
            onChangeText={setCode}
            placeholder="e.g. circle2026"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            style={[styles.input, { fontFamily: "monospace" }]}
            autoFocus
          />
          <TouchableOpacity
            testID="join-room-submit"
            style={[styles.primaryBtn, (!code.trim() || loading) && { opacity: 0.5 }]}
            disabled={!code.trim() || loading}
            onPress={submit}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Join room</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.hint}>
            Try{" "}
            <Text style={{ color: C.primary, fontFamily: "monospace" }}>circle2026</Text>{" "}
            to join the seeded "Privacy Circle" group.
          </Text>
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
  brandRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: R.sm,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: C.text, fontSize: 16, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: SP.sm },
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
  privacyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74,222,128,0.05)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(74,222,128,0.15)",
    paddingVertical: 6,
    paddingHorizontal: SP.lg,
  },
  privacyText: {
    color: C.primary,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1.5,
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.lg,
    padding: SP.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: R.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.primary, fontSize: 16, fontWeight: "700" },
  roomTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomName: { color: C.text, fontSize: 15, fontWeight: "600", flex: 1, marginRight: SP.sm },
  roomTime: {
    color: C.mutedAlt,
    fontSize: 11,
    fontFamily: "monospace",
  },
  roomBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  roomPreview: { color: C.muted, fontSize: 13, flex: 1 },
  vanishPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(74,222,128,0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.sm,
  },
  vanishText: { color: C.primary, fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SP.xl },
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
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: SP.lg,
  },
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
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.pill,
    paddingVertical: 14,
    paddingHorizontal: SP.lg,
    marginTop: SP.lg,
  },
  ghostBtnText: { color: C.text, fontSize: 14, fontWeight: "600" },

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
  label: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginBottom: SP.sm,
  },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
  },
  hint: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: SP.md },
  codeCard: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.4)",
    borderRadius: R.md,
    padding: SP.md,
    alignItems: "center",
  },
  codeLabel: { color: C.muted, fontSize: 11, fontFamily: "monospace", letterSpacing: 1.5 },
  codeText: {
    color: C.primary,
    fontSize: 22,
    fontFamily: "monospace",
    fontWeight: "700",
    marginVertical: SP.sm,
    letterSpacing: 1,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: SP.sm,
    paddingHorizontal: SP.md,
  },
  copyText: { color: C.primary, fontSize: 13, fontWeight: "600" },
});
