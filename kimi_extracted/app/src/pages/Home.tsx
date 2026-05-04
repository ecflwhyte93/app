import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import {
  Lock,
  EyeOff,
  Shield,
  Check,
  ChevronDown,
  ChevronUp,
  Github,
  Twitter,
  MessageCircle,
  ArrowRight,
  Zap,
  Users
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

/* ─── Navigation ─── */
function Navigation() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#111111]/90 backdrop-blur-xl border-b border-[#2D4A3E]/50'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-[#4ADE80]" />
          <span className="text-[#F4F4F5] font-medium text-sm tracking-wide">
            Silent Signal
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <button
              onClick={() => navigate('/app')}
              className="bg-[#F4F4F5] text-[#111111] px-5 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors"
            >
              Open App
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="bg-[#F4F4F5] text-[#111111] px-5 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors"
            >
              Get Started
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ─── ASCII Wave Background ─── */
function AsciiWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let time = 0

    const cols = 60
    const rows = 25
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*'

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }

    function draw() {
      if (!ctx || !canvas) return
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = '#111111'
      ctx.fillRect(0, 0, w, h)

      const cellW = w / cols
      const cellH = h / rows
      const fontSize = Math.min(cellW, cellH) * 0.8

      ctx.font = `${fontSize}px 'Geist Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let col = 0; col < cols; col++) {
        const colNorm = col / cols
        const waveOffset = Math.sin(colNorm * 8 + time * 2) * Math.cos(colNorm * 3 + time * 0.5)
        const columnHeight = Math.abs(waveOffset) * rows * 0.6

        for (let row = 0; row < rows; row++) {
          const rowCenter = rows / 2
          const distFromCenter = Math.abs(row - rowCenter)

          if (distFromCenter < columnHeight / 2) {
            const charIndex = Math.floor((Math.sin(colNorm * 12 + time + row * 0.3) * 0.5 + 0.5) * chars.length)
            const char = chars[charIndex % chars.length]
            const alpha = 1 - (distFromCenter / (columnHeight / 2)) * 0.6

            const x = col * cellW + cellW / 2
            const y = row * cellH + cellH / 2

            const r = Math.floor(138 + (74 - 138) * alpha)
            const g = Math.floor(154 + (222 - 154) * alpha)
            const b = Math.floor(132 + (128 - 132) * alpha)

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`
            ctx.fillText(char, x, y)
          }
        }
      }

      time += 0.015
      animId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-40"
      style={{ pointerEvents: 'none' }}
    />
  )
}

/* ─── Hero Section ─── */
function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-screen bg-[#111111] overflow-hidden flex items-center">
      <AsciiWave />

      {/* Gradient overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-b from-transparent to-[#111111] z-10 pointer-events-none" />

      <div className="relative z-20 max-w-[1200px] mx-auto px-6 w-full py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text content */}
          <div>
            <p className="text-[#8A9A84] text-xs uppercase tracking-[0.08em] mb-6">
              Encrypted. Private. Yours.
            </p>
            <h1 className="text-[#F4F4F5] text-5xl md:text-6xl lg:text-7xl font-normal leading-[0.9] tracking-[-0.03em]">
              Silent Signal
            </h1>
            <p className="text-[#A8A39A] text-lg mt-6 max-w-[480px] leading-relaxed">
              Messaging built for those who value their privacy. End-to-end encrypted,
              invite-only, and designed to disappear.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <button
                onClick={() => navigate('/login')}
                className="bg-[#F4F4F5] text-[#111111] px-8 py-3.5 rounded-lg text-sm font-medium hover:bg-white transition-all flex items-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="border border-[#2D4A3E] text-[#F4F4F5] px-8 py-3.5 rounded-lg text-sm font-medium hover:border-[#4ADE80] transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="animate-float">
              <img
                src="/phone-mockup.png"
                alt="Silent Signal App"
                className="w-[280px] rounded-[2rem] shadow-2xl shadow-black/50"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Features Section ─── */
function FeaturesSection() {
  const features = [
    {
      icon: <Lock className="w-10 h-10 text-[#4ADE80]" />,
      title: 'End-to-End Encrypted',
      description:
        'Your messages are encrypted on your device and can only be read by the intended recipient. Not even we can see them.',
    },
    {
      icon: <EyeOff className="w-10 h-10 text-[#4ADE80]" />,
      title: 'Vanishing Messages',
      description:
        'Set messages to disappear after they\'re read. No logs, no history, no trace.',
    },
    {
      icon: <Shield className="w-10 h-10 text-[#4ADE80]" />,
      title: 'Invite-Only Groups',
      description:
        'Create private groups that require an invitation to join. You\'re in control of who gets in.',
    },
  ]

  return (
    <section id="features" className="bg-[#111111] py-24 lg:py-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-[#8A9A84] text-xs uppercase tracking-[0.08em] mb-4">
            Why Silent Signal?
          </p>
          <h2 className="text-[#F4F4F5] text-3xl md:text-4xl font-normal tracking-[-0.02em]">
            Built for Privacy
          </h2>
          <p className="text-[#A8A39A] text-lg mt-4 max-w-[500px] mx-auto">
            Every message, every call, every moment — protected.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-[#1A1A1A] border border-[#2D4A3E] rounded-xl p-8 hover:border-[#4ADE80]/40 transition-all group"
            >
              <div className="mb-6 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-[#F4F4F5] text-xl font-normal mb-3">{f.title}</h3>
              <p className="text-[#A8A39A] text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── How It Works Section ─── */
function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Install the App',
      description:
        'Available on iOS, Android, and desktop. Sign up with just your phone number — no email, no name required.',
      icon: <Zap className="w-12 h-12 text-[#4ADE80]" />,
    },
    {
      num: '02',
      title: 'Invite Your Circle',
      description:
        'Send invitation links to your closest friends. Every group is private by default — no public discoverability.',
      icon: <Users className="w-12 h-12 text-[#4ADE80]" />,
    },
    {
      num: '03',
      title: 'Send with Confidence',
      description:
        'Messages are encrypted before they leave your device. Choose to make them vanish after reading for maximum privacy.',
      icon: <Lock className="w-12 h-12 text-[#4ADE80]" />,
    },
  ]

  return (
    <section className="bg-[#111111] py-24 lg:py-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="space-y-20">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex flex-col ${
                i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } gap-12 items-center`}
            >
              <div className="flex-1">
                <span className="text-[#8A9A84] font-mono text-sm">{step.num}</span>
                <h3 className="text-[#F4F4F5] text-2xl md:text-3xl font-normal mt-3 tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="text-[#A8A39A] text-lg mt-4 leading-relaxed">
                  {step.description}
                </p>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="w-[200px] h-[200px] border-2 border-[#2D4A3E] rounded-full flex items-center justify-center">
                  {step.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Messaging Demo Section ─── */
function MessagingDemoSection() {
  const demoMessages = [
    {
      text: 'Hey, are we still on for tonight?',
      incoming: true,
      time: '09:42',
    },
    {
      text: "Yeah, I'll be there. This app is wild 🔒",
      incoming: false,
      time: '09:43',
      status: 'delivered',
    },
    {
      text: 'Right? The disappearing messages are perfect for planning',
      incoming: true,
      time: '09:43',
    },
    {
      text: 'Exactly. See you at 8.',
      incoming: false,
      time: '09:44',
      status: 'read',
    },
  ]

  return (
    <section className="bg-gradient-to-b from-[#111111] to-[#1A1A1A] py-24 lg:py-32">
      <div className="max-w-[800px] mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-[#8A9A84] text-xs uppercase tracking-[0.08em] mb-4">
            Experience
          </p>
          <h2 className="text-[#F4F4F5] text-3xl md:text-4xl font-normal tracking-[-0.02em]">
            Seamless & Secure
          </h2>
        </div>

        {/* Phone mockup */}
        <div className="mx-auto max-w-[375px] rounded-[2rem] border border-[#2D4A3E] overflow-hidden bg-[#111111]">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2D4A3E]/50">
            <span className="text-[#8A9A84] font-mono text-xs">09:41</span>
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#4ADE80]" />
              <span className="text-[#F4F4F5] text-xs">Silent Signal</span>
            </div>
            <div className="w-8" />
          </div>

          {/* Chat area */}
          <div className="p-4 space-y-4 min-h-[400px]">
            {demoMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.incoming ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                    msg.incoming
                      ? 'bg-[#1A1A1A] text-[#F4F4F5] rounded-tl-sm'
                      : 'bg-[#2D4A3E] text-[#F4F4F5] rounded-tr-sm'
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <div className="flex items-center gap-1 mt-1.5 justify-end">
                    <span className="text-[10px] text-[#8A9A84] font-mono">
                      {msg.time}
                    </span>
                    {!msg.incoming && msg.status && (
                      <Check className={`w-3 h-3 ${msg.status === 'read' ? 'text-[#4ADE80]' : 'text-[#8A9A84]'}`} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[#2D4A3E]/50">
            <div className="flex-1 bg-[#1A1A1A] rounded-full px-4 py-2.5 text-sm text-[#8A9A84]">
              Type a secure message...
            </div>
            <div className="w-9 h-9 bg-[#4ADE80] rounded-full flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-[#111111]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Testimonials Section ─── */
function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Alex R.',
      role: 'Journalist',
      quote:
        'I use Silent Signal for all my sensitive source communications. The vanishing messages give me and my contacts peace of mind.',
    },
    {
      name: 'Maya T.',
      role: 'Software Engineer',
      quote:
        "Finally a messaging app that takes privacy seriously. The encryption is real, not marketing fluff.",
    },
    {
      name: 'Jordan K.',
      role: 'Activist',
      quote:
        "Our organizing group switched to Silent Signal last year. It's become essential for our work.",
    },
    {
      name: 'Sam L.',
      role: 'Student',
      quote:
        "I love that it doesn't ask for my email or track my data. It just works, securely.",
    },
    {
      name: 'Chris D.',
      role: 'Security Researcher',
      quote:
        "I've audited the encryption. It checks out. This is how messaging should work.",
    },
  ]

  return (
    <section className="bg-[#111111] py-24 lg:py-32">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-[#8A9A84] text-xs uppercase tracking-[0.08em] mb-4">
            What People Say
          </p>
          <h2 className="text-[#F4F4F5] text-3xl md:text-4xl font-normal tracking-[-0.02em]">
            Trusted by Privacy Advocates
          </h2>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="min-w-[320px] bg-[#1A1A1A] border border-[#2D4A3E] rounded-xl p-8 snap-start flex-shrink-0"
            >
              <p className="text-[#F4F4F5] text-sm italic leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6">
                <p className="text-[#8A9A84] text-sm">{t.name}</p>
                <p className="text-[#A8A39A] text-xs mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ Section ─── */
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqs = [
    {
      q: 'How is Silent Signal different from other messaging apps?',
      a: 'Silent Signal uses true end-to-end encryption where keys are generated on your device. We can\'t read your messages, and we don\'t store them on our servers after delivery.',
    },
    {
      q: 'Can I recover deleted messages?',
      a: "No. Once a message is set to disappear, it's permanently deleted from all devices. This is by design — true privacy means no recovery.",
    },
    {
      q: 'What data do you collect?',
      a: "We only store your account info for login. No contacts, no location, no metadata beyond what's required for message delivery.",
    },
    {
      q: 'Is the app open source?',
      a: 'Yes. Our encryption protocol and client applications are fully open source. You can audit the code yourself.',
    },
    {
      q: 'How do invites work?',
      a: 'You generate a secure invite link from the app and share it directly with friends. Each link is single-use and expires after 24 hours.',
    },
  ]

  return (
    <section className="bg-[#111111] py-24 lg:py-32">
      <div className="max-w-[800px] mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[#8A9A84] text-xs uppercase tracking-[0.08em] mb-4">
            Questions?
          </p>
          <h2 className="text-[#F4F4F5] text-3xl md:text-4xl font-normal tracking-[-0.02em]">
            Frequently Asked
          </h2>
        </div>

        <div>
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border-b border-[#2D4A3E] py-6"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between text-left group"
              >
                <span className="text-[#F4F4F5] text-base md:text-lg font-normal pr-4">
                  {faq.q}
                </span>
                <span className="text-[#8A9A84] text-xl flex-shrink-0 transition-transform duration-300">
                  {openIndex === i ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === i ? 'max-h-48 mt-4 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-[#A8A39A] text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="bg-[#111111] border-t border-[#2D4A3E]">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#4ADE80]" />
            <span className="text-[#F4F4F5] font-medium">Silent Signal</span>
          </div>
          <div className="flex gap-8">
            {['Privacy', 'Security', 'Support', 'Download'].map((link) => (
              <span
                key={link}
                className="text-[#A8A39A] text-sm hover:text-[#F4F4F5] transition-colors cursor-pointer"
              >
                {link}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-8 pt-8 border-t border-[#2D4A3E]/50">
          <p className="text-[#8A9A84] text-xs">
            &copy; 2025 Silent Signal. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Github className="w-5 h-5 text-[#8A9A84] hover:text-[#F4F4F5] transition-colors cursor-pointer" />
            <Twitter className="w-5 h-5 text-[#8A9A84] hover:text-[#F4F4F5] transition-colors cursor-pointer" />
            <MessageCircle className="w-5 h-5 text-[#8A9A84] hover:text-[#F4F4F5] transition-colors cursor-pointer" />
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Home Page ─── */
export default function Home() {
  return (
    <div className="bg-[#111111] min-h-screen">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <MessagingDemoSection />
      <TestimonialsSection />
      <FAQSection />
      <Footer />
    </div>
  )
}
