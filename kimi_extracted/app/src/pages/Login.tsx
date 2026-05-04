import { Lock, Shield, ArrowRight } from 'lucide-react'

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL
  const appID = import.meta.env.VITE_APP_ID
  const redirectUri = `${window.location.origin}/api/oauth/callback`
  const state = btoa(redirectUri)

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`)
  url.searchParams.set("client_id", appID)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "profile")
  url.searchParams.set("state", state)

  return url.toString()
}

export default function Login() {
  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #4ADE80 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#4ADE80]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[#2D4A3E]/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#2D4A3E] flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-[#4ADE80]" />
          </div>
          <h1 className="text-[#F4F4F5] text-2xl font-normal tracking-tight mb-2">
            Silent Signal
          </h1>
          <p className="text-[#8A9A84] text-sm">
            Secure, encrypted messaging
          </p>
        </div>

        {/* Login card */}
        <div className="bg-[#1A1A1A] border border-[#2D4A3E] rounded-xl p-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-[#4ADE80]/5 border border-[#4ADE80]/10 rounded-lg">
              <Shield className="w-5 h-5 text-[#4ADE80] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#F4F4F5] text-sm font-medium">End-to-End Encrypted</p>
                <p className="text-[#8A9A84] text-xs mt-0.5">
                  Your messages are encrypted on your device. Only you and your recipients can read them.
                </p>
              </div>
            </div>

            <button
              className="w-full bg-[#4ADE80] text-[#111111] py-3.5 rounded-lg text-sm font-medium hover:bg-[#22c55e] transition-colors flex items-center justify-center gap-2"
              onClick={() => {
                window.location.href = getOAuthUrl()
              }}
            >
              Sign in with Kimi
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[#8A9A84] text-xs text-center">
              By signing in, you agree to our commitment to privacy. We collect minimal data and never read your messages.
            </p>
          </div>
        </div>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-6 mt-8">
          <div className="flex items-center gap-1.5 text-[#8A9A84]">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-xs">AES-256</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#8A9A84]">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-xs">Zero Knowledge</span>
          </div>
        </div>
      </div>
    </div>
  )
}
