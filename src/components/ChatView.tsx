import { useState, useRef, useEffect } from 'react'
import type { LinkRecord, ChatMessage } from '../types'
import { API_BASE, AI_API_BASE } from '../lib/constants'
import { delay } from '../lib/helpers'

export function ChatView({ links }: { links: LinkRecord[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your personal knowledge assistant. Ask me anything about the ${links.length} link${links.length !== 1 ? 's' : ''} you've saved and I'll answer using only your library.`,
      sources: [],
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendChat() {
    const q = input.trim()
    if (!q || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setChatLoading(true)

    try {
      let answer: string
      let sources: ChatMessage['sources'] = []

      if (!API_BASE) {
        // Demo mode: client-side keyword search
        await delay(1200)
        const qLower = q.toLowerCase()
        const matches = links.filter(l => {
          const text = `${l.title} ${l.summary} ${l.tags.join(' ')} ${l.category}`.toLowerCase()
          return qLower.split(/\s+/).some(kw => kw.length > 2 && text.includes(kw))
        }).slice(0, 3)

        if (matches.length === 0) {
          answer = "I couldn't find anything about that in your library. Try saving some related links first!"
        } else {
          answer = `Based on your saved library, here's what I found:\n\n${matches.map((m, i) => `[${i + 1}] **${m.title}** — ${m.summary || 'No summary available.'}`).join('\n\n')}\n\n*(Demo mode — connect your Lambda for full AI responses)*`
          sources = matches.map(m => ({ id: m.id, title: m.title, url: m.url, category: m.category }))
        }
      } else {
        if (!AI_API_BASE) throw new Error('AI API not configured (VITE_AI_API_BASE)')
        const res = await fetch(`${AI_API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, library: links }),
        })
        if (!res.ok) throw new Error(`AI Server error ${res.status}`)
        const data = await res.json()
        answer = data.answer?.answer ?? data.answer
        sources = data.answer?.sources ?? data.sources ?? []
      }

      setMessages(prev => [...prev, { role: 'assistant', content: answer, sources, timestamp: new Date() }])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}`, sources: [], timestamp: new Date() }])
    } finally {
      setChatLoading(false)
    }
  }

  function handleChatKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--color-bg)] rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden chat-view">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0 chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-[85%] ${msg.role === 'user' ? 'self-end bg-[var(--chat-bubble-user)] rounded-tr-sm' : 'self-start bg-[var(--chat-bubble-assistant)] border border-[var(--border)] rounded-tl-sm'} p-3.5 px-4 rounded-2xl text-[var(--text-main)] shadow-sm chat-bubble chat-bubble-${msg.role}`}>
            <div className="chat-bubble-content">
              {msg.content.split('\n').map((line, j) => (
                <p key={j} className="m-0 leading-relaxed text-sm chat-line">{line}</p>
              ))}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-col gap-1.5 chat-sources">
                <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider chat-sources-label">Sources from your library:</div>
                {msg.sources.map((s, j) => (
                  <a key={j} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-main)] hover:border-[var(--border-hover)] transition-all chat-source-chip">
                    <span className="font-semibold text-[10px] text-[var(--accent-crimson)] uppercase chat-source-cat">{s.category}</span>
                    <span className="truncate flex-1 font-medium">{s.title}</span>
                    <span className="text-[11px] text-[var(--text-muted)] chat-source-arrow">↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="max-w-[85%] self-start p-3.5 px-4 rounded-2xl rounded-tl-sm bg-[var(--chat-bubble-assistant)] border border-[var(--border)] chat-bubble chat-bubble-assistant">
            <div className="flex gap-1.5 items-center chat-typing">
              <span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-pulse" /><span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-pulse delay-150" /><span className="w-2 h-2 rounded-full bg-[var(--text-muted)] animate-pulse delay-300" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 p-3 bg-[var(--bg-card)] border-t border-[var(--border)] chat-input-row">
        <input
          className="flex-1 bg-[var(--chat-input-bg)] border border-[var(--border)] text-[var(--text-main)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--accent-crimson)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none transition-all chat-input"
          type="text"
          placeholder={links.length === 0 ? 'Save some links first to chat…' : 'Ask anything about your saved links…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleChatKey}
          disabled={chatLoading || links.length === 0}
          autoFocus
        />
        <button
          className="flex items-center justify-center w-10 h-10 rounded-xl font-bold bg-[var(--chat-send-bg)] hover:bg-[var(--chat-send-bg-hover)] text-[var(--color-bg)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed chat-send-btn"
          onClick={handleSendChat}
          disabled={chatLoading || !input.trim() || links.length === 0}
        >
          {chatLoading ? <div className="save-btn-spinner" /> : '→'}
        </button>
      </div>

      {!API_BASE && (
        <div className="text-[11px] text-[var(--text-muted)] text-center py-1.5 bg-[var(--bg-input)] border-t border-[var(--border)] chat-demo-notice">
          Demo mode — connect your Lambda for full AI answers
        </div>
      )}
    </div>
  )
}
