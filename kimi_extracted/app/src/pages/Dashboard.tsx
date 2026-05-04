import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import { encryptMessage, decryptMessage } from '@/utils/encryption'
import {
  Lock,
  Send,
  Plus,
  Search,
  UserPlus,
  Check,
  X,
  LogOut,
  MessageSquare,
  Users,
  Shield,
  Copy,
  CheckCheck,
  Clock,
  ChevronLeft,
  Menu,
  KeyRound,
  Eye,
  EyeOff,
  Settings,
  Phone,
} from 'lucide-react'

/* ─── Sidebar ─── */
function Sidebar({
  selectedRoomId,
  onSelectRoom,
  onShowCreateRoom,
  onShowJoinRoom,
  onShowAddFriend,
  onShowSettings,
  showMobile,
  onCloseMobile,
}: {
  selectedRoomId: number | null
  onSelectRoom: (roomId: number) => void
  onShowCreateRoom: () => void
  onShowJoinRoom: () => void
  onShowAddFriend: () => void
  onShowSettings: () => void
  showMobile: boolean
  onCloseMobile: () => void
}) {
  const { user, logout } = useAuth()
  const utils = trpc.useUtils()
  const { data: rooms } = trpc.room.list.useQuery()
  const { data: friends } = trpc.friend.list.useQuery()
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats')

  const acceptMutation = trpc.friend.accept.useMutation({
    onSuccess: () => {
      utils.friend.list.invalidate()
      utils.room.list.invalidate()
    },
  })

  const declineMutation = trpc.friend.decline.useMutation({
    onSuccess: () => {
      utils.friend.list.invalidate()
    },
  })

  const pendingRequests = friends?.filter((f) => f.status === 'pending' && !f.isRequester) || []

  return (
    <div
      className={`${
        showMobile ? 'fixed inset-0 z-50' : 'hidden'
      } md:flex md:relative md:inset-auto md:z-auto flex-col w-full md:w-80 bg-[#111111] border-r border-[#2D4A3E] h-full`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2D4A3E]">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-[#4ADE80]" />
          <span className="text-[#F4F4F5] font-medium text-sm tracking-wide">Silent Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onShowAddFriend(); onCloseMobile() }}
            className="p-2 text-[#8A9A84] hover:text-[#4ADE80] hover:bg-[#1A1A1A] rounded-lg transition-colors"
            title="Add Friend"
          >
            <UserPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onShowSettings(); onCloseMobile() }}
            className="p-2 text-[#8A9A84] hover:text-[#4ADE80] hover:bg-[#1A1A1A] rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => logout()}
            className="p-2 text-[#8A9A84] hover:text-red-400 hover:bg-[#1A1A1A] rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button onClick={onCloseMobile} className="p-2 text-[#8A9A84] md:hidden">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-[#2D4A3E]/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#2D4A3E] flex items-center justify-center">
            <span className="text-[#4ADE80] text-xs font-medium">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#F4F4F5] text-sm truncate">{user?.name || 'Anonymous'}</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
              <span className="text-[#8A9A84] text-xs">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2D4A3E]/50">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${
            activeTab === 'chats'
              ? 'text-[#4ADE80] border-b-2 border-[#4ADE80]'
              : 'text-[#8A9A84] hover:text-[#F4F4F5]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Chats
          </div>
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${
            activeTab === 'friends'
              ? 'text-[#4ADE80] border-b-2 border-[#4ADE80]'
              : 'text-[#8A9A84] hover:text-[#F4F4F5]'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Friends
            {pendingRequests.length > 0 && (
              <span className="bg-[#4ADE80] text-[#111111] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chats' ? (
          <div>
            {/* Quick actions */}
            <div className="p-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => { onShowCreateRoom(); onCloseMobile() }}
                className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] hover:bg-[#2D4A3E]/30 text-[#F4F4F5] text-xs py-2.5 rounded-lg border border-[#2D4A3E] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Group
              </button>
              <button
                onClick={() => { onShowJoinRoom(); onCloseMobile() }}
                className="flex items-center justify-center gap-1.5 bg-[#1A1A1A] hover:bg-[#2D4A3E]/30 text-[#F4F4F5] text-xs py-2.5 rounded-lg border border-[#2D4A3E] transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                Join Room
              </button>
            </div>

            {/* Room list */}
            {rooms?.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-[#2D4A3E] mx-auto mb-3" />
                <p className="text-[#8A9A84] text-sm">No conversations yet</p>
                <p className="text-[#8A9A84] text-xs mt-1">Add friends to start chatting</p>
              </div>
            )}
            {rooms?.map((room) => (
              <button
                key={room.id}
                onClick={() => { onSelectRoom(room.id); onCloseMobile() }}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#1A1A1A] transition-colors ${
                  selectedRoomId === room.id ? 'bg-[#1A1A1A] border-l-2 border-[#4ADE80]' : 'border-l-2 border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  room.type === 'dm' ? 'bg-[#2D4A3E]' : 'bg-[#4ADE80]/20'
                }`}>
                  {room.type === 'dm' ? (
                    <span className="text-[#4ADE80] text-sm font-medium">
                      {room.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  ) : (
                    <Users className="w-4 h-4 text-[#4ADE80]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[#F4F4F5] text-sm truncate">{room.name}</p>
                    {room.lastMessage && (
                      <span className="text-[10px] text-[#8A9A84] font-mono flex-shrink-0 ml-2">
                        {new Date(room.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {room.type === 'group' && (
                      <span className="text-[10px] text-[#8A9A84]">{room.memberCount} members</span>
                    )}
                    {room.lastMessage && (
                      <p className="text-[#8A9A84] text-xs truncate">
                        {room.type === 'group' && <span className="text-[#8A9A84]">{room.lastMessage.senderName}: </span>}
                        <span className="opacity-60">[encrypted]</span>
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            {/* Friend requests section */}
            {pendingRequests.length > 0 && (
              <div className="p-3">
                <p className="text-[#8A9A84] text-xs uppercase tracking-wider mb-2">Requests</p>
                {pendingRequests.map((f) => (
                  <div key={f.id} className="bg-[#1A1A1A] rounded-lg p-3 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[#2D4A3E] flex items-center justify-center">
                        <span className="text-[#4ADE80] text-xs">{f.otherUser.name?.[0] || '?'}</span>
                      </div>
                      <div>
                        <p className="text-[#F4F4F5] text-sm">{f.otherUser.name || 'Unknown'}</p>
                        <p className="text-[#8A9A84] text-xs">wants to connect</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptMutation.mutate({ friendId: f.id })}
                        disabled={acceptMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 bg-[#4ADE80] text-[#111111] text-xs py-2 rounded-md font-medium hover:bg-[#22c55e] disabled:opacity-40 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Accept
                      </button>
                      <button
                        onClick={() => declineMutation.mutate({ friendId: f.id })}
                        disabled={declineMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 bg-[#1A1A1A] text-[#8A9A84] text-xs py-2 rounded-md border border-[#2D4A3E] hover:border-red-500/50 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Friends list */}
            <div className="p-3">
              <p className="text-[#8A9A84] text-xs uppercase tracking-wider mb-2">Your Friends</p>
              {friends?.filter((f) => f.status === 'accepted').length === 0 && (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-[#2D4A3E] mx-auto mb-2" />
                  <p className="text-[#8A9A84] text-xs">No friends yet</p>
                  <p className="text-[#8A9A84] text-xs mt-1">Use the + button to add friends</p>
                </div>
              )}
              {friends
                ?.filter((f) => f.status === 'accepted')
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1A1A1A] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#2D4A3E] flex items-center justify-center">
                      <span className="text-[#4ADE80] text-xs">{f.otherUser.name?.[0] || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#F4F4F5] text-sm truncate">{f.otherUser.name || 'Unknown'}</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Chat Area ─── */
function ChatArea({
  roomId,
  onBack,
}: {
  roomId: number
  onBack: () => void
}) {
  const { user } = useAuth()
  const utils = trpc.useUtils()
  const [inputText, setInputText] = useState('')
  const [isEphemeral, setIsEphemeral] = useState(false)
  const [decryptedMessages, setDecryptedMessages] = useState<Map<number, string>>(new Map())
  const [isEncrypting, setIsEncrypting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: room } = trpc.room.get.useQuery({ roomId })
  const { data: messages } = trpc.message.list.useQuery(
    { roomId, limit: 100 },
    { refetchInterval: 3000 }
  )

  const sendMessage = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.list.invalidate({ roomId })
      utils.room.list.invalidate()
    },
  })

  // Decrypt messages
  useEffect(() => {
    if (!messages) return

    const decryptAll = async () => {
      const newMap = new Map(decryptedMessages)
      for (const msg of messages) {
        if (!newMap.has(msg.id)) {
          const plain = await decryptMessage(msg.ciphertext, msg.iv, msg.salt)
          newMap.set(msg.id, plain)
        }
      }
      setDecryptedMessages(newMap)
    }

    decryptAll()
  }, [messages])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages?.length])

  const handleSend = async () => {
    if (!inputText.trim()) return

    setIsEncrypting(true)
    try {
      const encrypted = await encryptMessage(inputText.trim())
      sendMessage.mutate({
        roomId,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        salt: encrypted.salt,
        ephemeral: isEphemeral,
      })
      setInputText('')
    } catch (err) {
      console.error('Encryption failed:', err)
    } finally {
      setIsEncrypting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A]">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2D4A3E] bg-[#111111]">
        <button onClick={onBack} className="p-2 text-[#8A9A84] hover:text-[#F4F4F5] md:hidden">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
          room?.type === 'dm' ? 'bg-[#2D4A3E]' : 'bg-[#4ADE80]/20'
        }`}>
          {room?.type === 'dm' ? (
            <span className="text-[#4ADE80] text-sm font-medium">
              {room?.name?.[0]?.toUpperCase() || '?'}
            </span>
          ) : (
            <Users className="w-4 h-4 text-[#4ADE80]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#F4F4F5] text-sm font-medium truncate">{room?.name || 'Loading...'}</p>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-[#4ADE80]" />
            <span className="text-[#8A9A84] text-xs">
              {room?.type === 'dm' ? 'End-to-end encrypted' : `${room?.members?.length || 0} members`}
            </span>
          </div>
        </div>
        {room?.type === 'group' && room.inviteCode && (
          <CopyInviteCode code={room.inviteCode} />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Shield className="w-12 h-12 text-[#2D4A3E] mb-4" />
            <p className="text-[#8A9A84] text-sm">This conversation is secured</p>
            <p className="text-[#8A9A84] text-xs mt-1">Messages are end-to-end encrypted</p>
          </div>
        )}

        {messages?.map((msg) => {
          const isOwn = msg.senderId === user?.id
          const plain = decryptedMessages.get(msg.id)

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] ${isOwn ? 'order-2' : 'order-1'}`}>
                {!isOwn && (
                  <p className="text-[10px] text-[#8A9A84] mb-1 ml-1">{msg.senderName || 'Unknown'}</p>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl ${
                    isOwn
                      ? 'bg-[#2D4A3E] text-[#F4F4F5] rounded-tr-sm'
                      : 'bg-[#1A1A1A] text-[#F4F4F5] rounded-tl-sm'
                  }`}
                >
                  {msg.ephemeral && (
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 text-[#4ADE80]" />
                      <span className="text-[10px] text-[#4ADE80]">Vanishing</span>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{plain || 'Decrypting...'}</p>
                </div>
                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] text-[#8A9A84] font-mono">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isOwn && (
                    <CheckCheck className="w-3 h-3 text-[#4ADE80]" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-[#2D4A3E] bg-[#111111]">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsEphemeral(!isEphemeral)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md transition-colors ${
              isEphemeral
                ? 'bg-[#4ADE80]/20 text-[#4ADE80] border border-[#4ADE80]/30'
                : 'text-[#8A9A84] hover:text-[#F4F4F5] border border-transparent'
            }`}
          >
            {isEphemeral ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {isEphemeral ? 'Vanish' : 'Normal'}
          </button>
          {isEncrypting && (
            <div className="flex items-center gap-1 text-[#4ADE80] text-xs">
              <KeyRound className="w-3 h-3 animate-spin" />
              Encrypting...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a secure message..."
            className="flex-1 bg-[#1A1A1A] text-[#F4F4F5] text-sm px-4 py-3 rounded-xl border border-[#2D4A3E] focus:outline-none focus:border-[#4ADE80] placeholder:text-[#8A9A84]/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sendMessage.isPending}
            className="w-11 h-11 bg-[#4ADE80] rounded-xl flex items-center justify-center hover:bg-[#22c55e] disabled:opacity-40 disabled:hover:bg-[#4ADE80] transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4 text-[#111111]" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Copy Invite Code ─── */
function CopyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-[#8A9A84] hover:text-[#4ADE80] transition-colors"
      title="Copy invite code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="font-mono hidden sm:inline">{code.slice(0, 8)}...</span>
    </button>
  )
}

/* ─── Modals ─── */
function CreateRoomModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const utils = trpc.useUtils()

  const createRoom = trpc.room.create.useMutation({
    onSuccess: () => {
      utils.room.list.invalidate()
    },
  })

  return (
    <Modal onClose={onClose} title="Create Group Room">
      <div className="space-y-4">
        <div>
          <label className="text-[#8A9A84] text-xs uppercase tracking-wider mb-2 block">Room Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter room name..."
            className="w-full bg-[#1A1A1A] text-[#F4F4F5] text-sm px-4 py-3 rounded-lg border border-[#2D4A3E] focus:outline-none focus:border-[#4ADE80] placeholder:text-[#8A9A84]/50"
          />
        </div>
        {createRoom.data?.inviteCode && (
          <div className="bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-lg p-3">
            <p className="text-[#4ADE80] text-xs mb-1">Room created! Share this invite code:</p>
            <div className="flex items-center gap-2">
              <code className="text-[#F4F4F5] font-mono text-sm flex-1">{createRoom.data.inviteCode}</code>
              <CopyInviteCode code={createRoom.data.inviteCode} />
            </div>
          </div>
        )}
        <button
          onClick={() => createRoom.mutate({ name })}
          disabled={!name.trim() || createRoom.isPending}
          className="w-full bg-[#4ADE80] text-[#111111] py-3 rounded-lg text-sm font-medium hover:bg-[#22c55e] disabled:opacity-40 transition-colors"
        >
          {createRoom.isPending ? 'Creating...' : createRoom.data ? 'Created!' : 'Create Room'}
        </button>
      </div>
    </Modal>
  )
}

function JoinRoomModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('')
  const utils = trpc.useUtils()

  const joinRoom = trpc.room.join.useMutation({
    onSuccess: () => {
      utils.room.list.invalidate()
      onClose()
    },
  })

  return (
    <Modal onClose={onClose} title="Join Room">
      <div className="space-y-4">
        <div>
          <label className="text-[#8A9A84] text-xs uppercase tracking-wider mb-2 block">Invite Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste invite code..."
            className="w-full bg-[#1A1A1A] text-[#F4F4F5] text-sm px-4 py-3 rounded-lg border border-[#2D4A3E] focus:outline-none focus:border-[#4ADE80] placeholder:text-[#8A9A84]/50 font-mono"
          />
        </div>
        {joinRoom.error && (
          <p className="text-red-400 text-xs">{joinRoom.error.message}</p>
        )}
        <button
          onClick={() => joinRoom.mutate({ inviteCode: code })}
          disabled={!code.trim() || joinRoom.isPending}
          className="w-full bg-[#4ADE80] text-[#111111] py-3 rounded-lg text-sm font-medium hover:bg-[#22c55e] disabled:opacity-40 transition-colors"
        >
          {joinRoom.isPending ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </Modal>
  )
}

function AddFriendModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const utils = trpc.useUtils()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: searchResults } = trpc.friend.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 0 }
  )

  const requestFriend = trpc.friend.request.useMutation({
    onSuccess: () => {
      utils.friend.list.invalidate()
      setQuery('')
    },
  })

  return (
    <Modal onClose={onClose} title="Add Friend">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9A84]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-[#1A1A1A] text-[#F4F4F5] text-sm pl-10 pr-4 py-3 rounded-lg border border-[#2D4A3E] focus:outline-none focus:border-[#4ADE80] placeholder:text-[#8A9A84]/50"
          />
        </div>

        {debouncedQuery.length > 0 && searchResults?.length === 0 && (
          <p className="text-[#8A9A84] text-sm text-center py-4">No users found</p>
        )}

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {searchResults?.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 p-3 bg-[#1A1A1A] rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-[#2D4A3E] flex items-center justify-center flex-shrink-0">
                <span className="text-[#4ADE80] text-sm">{u.name?.[0] || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#F4F4F5] text-sm truncate">{u.name || 'Unknown'}</p>
                <p className="text-[#8A9A84] text-xs truncate">{u.email}</p>
                {u.phone && (
                  <p className="text-[#4ADE80] text-xs truncate font-mono flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    {u.phone}
                  </p>
                )}
              </div>
              <button
                onClick={() => requestFriend.mutate({ addresseeId: u.id })}
                disabled={requestFriend.isPending}
                className="flex items-center gap-1 bg-[#4ADE80] text-[#111111] text-xs px-3 py-2 rounded-md font-medium hover:bg-[#22c55e] disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <UserPlus className="w-3 h-3" />
                Add
              </button>
            </div>
          ))}
        </div>

        <p className="text-[#8A9A84] text-xs text-center">
          Tip: You can also search by phone number if your friends have set one.
        </p>

        {requestFriend.isSuccess && (
          <p className="text-[#4ADE80] text-xs text-center">Friend request sent!</p>
        )}
      </div>
    </Modal>
  )
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111111] border border-[#2D4A3E] rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[#F4F4F5] text-lg font-medium">{title}</h3>
          <button onClick={onClose} className="text-[#8A9A84] hover:text-[#F4F4F5] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─── Settings Modal ─── */
function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const utils = trpc.useUtils()
  const [phone, setPhone] = useState(user?.phone || '')
  const [name, setName] = useState(user?.name || '')

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate()
    },
  })

  const handleSave = () => {
    const updates: { phone?: string; name?: string } = {}
    if (phone.trim()) updates.phone = phone.trim()
    if (name.trim()) updates.name = name.trim()
    if (Object.keys(updates).length > 0) {
      updateProfile.mutate(updates)
    }
  }

  return (
    <Modal onClose={onClose} title="Profile Settings">
      <div className="space-y-5">
        <div>
          <label className="text-[#8A9A84] text-xs uppercase tracking-wider mb-2 block">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name..."
            className="w-full bg-[#1A1A1A] text-[#F4F4F5] text-sm px-4 py-3 rounded-lg border border-[#2D4A3E] focus:outline-none focus:border-[#4ADE80] placeholder:text-[#8A9A84]/50"
          />
        </div>

        <div>
          <label className="text-[#8A9A84] text-xs uppercase tracking-wider mb-2 block">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A9A84]" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full bg-[#1A1A1A] text-[#F4F4F5] text-sm pl-10 pr-4 py-3 rounded-lg border border-[#2D4A3E] focus:outline-none focus:border-[#4ADE80] placeholder:text-[#8A9A84]/50"
            />
          </div>
          <p className="text-[#8A9A84] text-xs mt-1.5">
            Friends can find and invite you by this phone number.
          </p>
        </div>

        <div className="bg-[#4ADE80]/5 border border-[#4ADE80]/10 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-[#4ADE80] flex-shrink-0 mt-0.5" />
            <p className="text-[#8A9A84] text-xs">
              Your phone number is only used for friend discovery. It is not shared with third parties.
            </p>
          </div>
        </div>

        {updateProfile.error && (
          <p className="text-red-400 text-xs">{updateProfile.error.message}</p>
        )}
        {updateProfile.isSuccess && (
          <p className="text-[#4ADE80] text-xs text-center">Profile updated!</p>
        )}

        <button
          onClick={handleSave}
          disabled={updateProfile.isPending}
          className="w-full bg-[#4ADE80] text-[#111111] py-3 rounded-lg text-sm font-medium hover:bg-[#22c55e] disabled:opacity-40 transition-colors"
        >
          {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  )
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { isLoading, isAuthenticated } = useAuth()
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showJoinRoom, setShowJoinRoom] = useState(false)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Lock className="w-8 h-8 text-[#4ADE80] animate-pulse" />
          <p className="text-[#8A9A84] text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="h-screen bg-[#111111] flex overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          onShowCreateRoom={() => setShowCreateRoom(true)}
          onShowJoinRoom={() => setShowJoinRoom(true)}
          onShowAddFriend={() => setShowAddFriend(true)}
          onShowSettings={() => setShowSettings(true)}
          showMobile={false}
          onCloseMobile={() => {}}
        />
      </div>

      {/* Mobile sidebar */}
      {showMobileSidebar && (
        <Sidebar
          selectedRoomId={selectedRoomId}
          onSelectRoom={(id) => { setSelectedRoomId(id); setShowMobileSidebar(false) }}
          onShowCreateRoom={() => setShowCreateRoom(true)}
          onShowJoinRoom={() => setShowJoinRoom(true)}
          onShowAddFriend={() => setShowAddFriend(true)}
          onShowSettings={() => setShowSettings(true)}
          showMobile={true}
          onCloseMobile={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedRoomId ? (
          <ChatArea
            roomId={selectedRoomId}
            onBack={() => {
              setSelectedRoomId(null)
              setShowMobileSidebar(true)
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="md:hidden absolute top-4 left-4 p-2 text-[#8A9A84]"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="w-20 h-20 rounded-full bg-[#2D4A3E] flex items-center justify-center mb-6">
              <Shield className="w-10 h-10 text-[#4ADE80]" />
            </div>
            <h2 className="text-[#F4F4F5] text-2xl font-normal mb-2">
              Welcome to Silent Signal
            </h2>
            <p className="text-[#8A9A84] text-sm max-w-[360px] mb-8">
              Select a conversation from the sidebar or add friends to start secure messaging.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => setShowAddFriend(true)}
                className="flex items-center gap-2 bg-[#4ADE80] text-[#111111] px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#22c55e] transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Friend
              </button>
              <button
                onClick={() => setShowCreateRoom(true)}
                className="flex items-center gap-2 bg-[#1A1A1A] text-[#F4F4F5] px-5 py-2.5 rounded-lg text-sm border border-[#2D4A3E] hover:border-[#4ADE80] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Group
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateRoom && <CreateRoomModal onClose={() => setShowCreateRoom(false)} />}
      {showJoinRoom && <JoinRoomModal onClose={() => setShowJoinRoom(false)} />}
      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
