'use client'

import { useEffect, useState, useRef } from 'react'

const DEFAULT_WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'ai',
  text: 'Assalam-o-Alaikum! Main aapka Zebra AI Business Advisor hoon. Aap mujhse dukan ki sale, munafa, udhar, stock, aur kharchay ke baare me kuch bhi pooch sakte hain.',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  mode: 'ready',
}

function FormattedChatMessage({ text, isUser }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
  }

  // Parse inline bold **text** and *italic*
  const renderInlineFormatted = (str) => {
    if (!str) return null
    const parts = str.split(/(\*\*.*?\*\*|\*[^\*]+\*)/g)
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2)
        return <strong key={pIdx} className="font-extrabold text-gray-950">{inner}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        const inner = part.slice(1, -1)
        return <span key={pIdx} className="italic text-gray-700">{inner}</span>
      }
      return part
    })
  }

  const lines = (text || '').split('\n')
  const blocks = []
  let currentBullets = []

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      blocks.push({
        type: 'bulletList',
        items: [...currentBullets],
      })
      currentBullets = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushBullets()
      blocks.push({ type: 'empty' })
      continue
    }

    // Dividers (--- or ━━━━ or ***)
    if (/^[-━_]{3,}$/.test(trimmed)) {
      flushBullets()
      blocks.push({ type: 'divider' })
      continue
    }

    // Headings: ###, ##, #
    if (trimmed.startsWith('#')) {
      flushBullets()
      const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
      blocks.push({ type: 'heading', text: cleanHeader })
      continue
    }

    // Bullet points: *, -, •, or numbered like 1. or 1)
    if (/^([\*\-•]|\d+[\.\)])\s+/.test(trimmed)) {
      const cleanBullet = trimmed.replace(/^([\*\-•]|\d+[\.\)])\s+/, '').trim()
      currentBullets.push(cleanBullet)
      continue
    }

    // Regular text line
    flushBullets()
    blocks.push({ type: 'paragraph', text: trimmed })
  }
  flushBullets()

  return (
    <div className="space-y-1.5 text-xs text-gray-800 leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'empty') {
          return <div key={idx} className="h-0.5" />
        }
        if (block.type === 'divider') {
          return <hr key={idx} className="my-1.5 border-gray-200" />
        }
        if (block.type === 'heading') {
          return (
            <div key={idx} className="font-extrabold text-xs text-emerald-950 pt-1 pb-0.5 flex items-center gap-1.5 border-b border-emerald-100">
              <span className="text-emerald-700 font-bold">📌</span>
              <span>{block.text}</span>
            </div>
          )
        }
        if (block.type === 'bulletList') {
          return (
            <div key={idx} className="space-y-1 pl-0.5 my-1">
              {block.items.map((item, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-600 font-black text-sm leading-none mt-0.5">•</span>
                  <div className="flex-1 leading-relaxed text-gray-800">
                    {renderInlineFormatted(item)}
                  </div>
                </div>
              ))}
            </div>
          )
        }
        return (
          <div key={idx} className="leading-relaxed">
            {renderInlineFormatted(block.text)}
          </div>
        )
      })}
    </div>
  )
}

export default function AIAdvisor() {
  const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE])
  const [inputQuery, setInputQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState(null)
  const [isOnline, setIsOnline] = useState(true)
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    // Check navigator online status
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Load persistent chat history from SQLite
  useEffect(() => {
    async function loadChatHistory() {
      try {
        const res = await fetch('/api/ai-advisor?history=true')
        const data = await res.json()
        if (data && data.ok && Array.isArray(data.history) && data.history.length > 0) {
          setMessages(data.history)
        }
      } catch (err) {
        console.warn('Could not load AI chat history:', err)
      }
    }
    loadChatHistory()
  }, [])

  // Fetch proactive anomaly insights & check server gemini status
  useEffect(() => {
    async function loadInsights() {
      try {
        const res = await fetch('/api/ai-advisor')
        const data = await res.json()
        if (data && data.ok) {
          setInsights(data)
          if (data.geminiConfigured !== undefined) {
            setGeminiConfigured(Boolean(data.geminiConfigured))
          }
        }
      } catch (err) {
        console.warn('Could not load AI insights:', err)
      }
    }
    loadInsights()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (queryText) => {
    const textToSend = (queryText || inputQuery).trim()
    if (!textToSend || loading) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
        }),
      })

      const data = await res.json()

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: data?.response || 'Maaf kijiye ga, is waqt data fetch karne me masla aa raha hai.',
        mode: data?.mode || (isOnline && geminiConfigured ? 'online' : 'offline'),
        engine: data?.engine || 'Local Database Engine',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'Error: Request complete nahi ho saki. Please dobara koshish karein.',
          mode: 'error',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Kya aap waqai tamaam chat history delete karna chahte hain?')) {
      return
    }
    try {
      await fetch('/api/ai-advisor', { method: 'DELETE' })
      setMessages([DEFAULT_WELCOME_MESSAGE])
    } catch (err) {
      console.error('Failed to clear chat history:', err)
    }
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-indigo-950 text-white p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-emerald-800/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl shadow-inner">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Zebra AI Business Advisor</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Enterprise AI
              </span>
            </div>
            <p className="text-xs text-emerald-200/80">
              Dual-Engine Financial Intelligence & Automatic Business Anomaly Monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isOnline
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>
              {isOnline
                ? geminiConfigured
                  ? 'Online (Gemini Ready)'
                  : 'Online (Local Engine Active)'
                : 'Offline (Local Engine Active)'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearHistory}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-white text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/10"
            title="Clear Chat History from Database"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>
      </div>

      {/* Proactive Anomaly Cards */}
      {insights?.anomalies && insights.anomalies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.anomalies.map((ano, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 shadow-sm ${
                ano.type === 'warning'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : ano.type === 'notice'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
              }`}
            >
              <span className="text-lg">
                {ano.type === 'warning' ? '⚠️' : ano.type === 'notice' ? '📦' : 'ℹ️'}
              </span>
              <div className="space-y-0.5">
                <span className="font-bold block">{ano.title}</span>
                <span className="text-[11px] leading-relaxed opacity-90 block">{ano.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Chat Interface */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[520px] overflow-hidden">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user'
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 font-bold ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isUser ? '👤' : '🤖'}
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed space-y-2 shadow-sm ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white border border-gray-200/80 text-gray-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  <FormattedChatMessage text={msg.text} isUser={isUser} />
                  <div className="flex items-center justify-between gap-4 text-[10px] opacity-70 border-t border-black/5 pt-1">
                    <span>{msg.timestamp}</span>
                    {!isUser && msg.mode && (
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider">
                        {msg.mode === 'online' ? '🟢 Gemini Cloud' : '⚡ Local Engine'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center text-sm">
                🤖
              </div>
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-2xl text-xs text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                <span>Database se hisab analyze kiya ja raha hai...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-gray-50/70 border-t border-gray-100 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
          <span className="text-gray-400 font-bold shrink-0">Quick Queries:</span>
          {[
            'Aaj ki sale aur rokar kitni hai?',
            'Is mahine ka profit / munafa kitna hua?',
            'Sub se zyada udhar kis customer ka hai?',
            'Cash aur bank me kitna balance hai?',
            'Konsa maal khatam hone wala hai?',
            'Is mahine ka total kharcha kitna hai?',
            'Sab se zyada biknay wala item konsa hai?',
          ].map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors shrink-0 shadow-2xs font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Query Input Bar */}
        <div className="p-3 bg-white border-t flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Poochhein: maslan 'aaj ki sale', 'top 5 udhar', 'kam stock', ya 'kharcha'..."
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !inputQuery.trim()}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
          >
            <span>Bhejein</span>
            <span>➤</span>
          </button>
        </div>
      </div>
    </div>
  )
}
