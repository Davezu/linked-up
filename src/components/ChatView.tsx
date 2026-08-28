import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  BookOpen,
  Lightbulb,
  Search,
  FileText,
  ExternalLink,
  ArrowUp,
  Copy,
  Check,
  RotateCcw,
  Pencil,
  Plus
} from 'lucide-react'
import type { LinkRecord, NoteRecord, ChatMessage } from '../types'
import { API_BASE, AI_API_BASE } from '../lib/constants'
import { delay } from '../lib/helpers'
import { MarkdownRenderer } from './MarkdownRenderer'

const SUGGESTED_PROMPTS = [
  {
    icon: Lightbulb,
    title: 'Summarize my library',
    prompt: 'Give me a summary of the main topics and themes in my saved library.',
  },
  {
    icon: Search,
    title: 'Find key resources',
    prompt: 'Which saved links in my library contain the most detailed information?',
  },
  {
    icon: FileText,
    title: 'Review key insights',
    prompt: 'What are the main insights and takeaways from my collection of links and notes?',
  },
  {
    icon: BookOpen,
    title: 'Recommend next read',
    prompt: 'Based on what I have saved, what should I read or focus on next?',
  },
]

export function ChatView({
  links,
  notes = [],
  onSelectView,
  onOpenNoteFolder,
}: {
  links: LinkRecord[]
  notes?: NoteRecord[]
  onSelectView?: (view: 'library' | 'notes' | 'chat') => void
  onOpenNoteFolder?: (folder?: string | null) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollAreaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, chatLoading])

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  async function handleSend(textToSend?: string) {
    const q = (textToSend ?? input).trim()
    if (!q || chatLoading) return

    const userMsg: ChatMessage = { role: 'user', content: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setChatLoading(true)

    try {
      let answer: string
      let sources: ChatMessage['sources'] = []

      if (!API_BASE) {
        // Demo mode: client-side keyword search across links and notes
        await delay(1200)
        const qLower = q.toLowerCase()
        const matchLinks = links.filter(l => {
          const text = `${l.title} ${l.summary} ${l.tags.join(' ')} ${l.category}`.toLowerCase()
          return qLower.split(/\s+/).some(kw => kw.length > 2 && text.includes(kw))
        }).slice(0, 4)
        const matchNotes = notes.filter(n => {
          const text = `${n.title} ${n.content} ${(n.tags ?? []).join(' ')} ${n.folder ?? ''}`.toLowerCase()
          return qLower.split(/\s+/).some(kw => kw.length > 2 && text.includes(kw))
        }).slice(0, 4)

        if (matchLinks.length === 0 && matchNotes.length === 0) {
          answer = "I couldn't find relevant links or notes for that topic in your saved collection. Try asking about saved topics or add related notes/links first!"
        } else {
          answer = `Based on your saved links and notes, here is what I found:\n\n${matchLinks.map((m, i) => `[L${i + 1}] **${m.title}**\n${m.summary || 'No summary provided.'}`).join('\n\n')}\n\n${matchNotes.map((n, i) => `[N${i + 1}] **${n.title}**\n${n.content || 'Empty note.'}`).join('\n\n')}\n\n*(Demo mode — connect AI backend for full generative responses)*`
          sources = [
            ...matchLinks.map(m => ({ id: m.id, title: m.title, url: m.url, category: m.category })),
            ...matchNotes.map(n => ({ id: n.id, title: n.title, url: '#', category: n.folder || 'Note' }))
          ]
        }
      } else {
        if (!AI_API_BASE) throw new Error('AI API not configured (VITE_AI_API_BASE)')
        const res = await fetch(`${AI_API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, library: links, notes }),
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-container">
      {/* Messages Scroll Area */}
      <div ref={scrollAreaRef} className="chat-scroll-area">
        <div className="chat-max-width">
          {messages.length === 0 ? (
            <div className="chat-empty-hero">
              <div className="chat-hero-icon-wrapper">
                <Sparkles size={28} className="chat-hero-icon" />
              </div>
              <h2 className="chat-hero-title">Ask AI about your library</h2>
              <p className="chat-hero-subtitle">
                Ask questions, generate summaries, or discover insights across your{' '}
                <strong className="chat-hero-count">{links.length} saved link{links.length === 1 ? '' : 's'}</strong>.
              </p>

              <div className="chat-prompts-grid">
                {SUGGESTED_PROMPTS.map(({ icon: Icon, title, prompt }) => (
                  <button
                    key={title}
                    type="button"
                    className="chat-prompt-card"
                    onClick={() => handleSend(prompt)}
                    disabled={links.length === 0 && notes.length === 0}
                  >
                    <div className="chat-prompt-header">
                      <Icon size={16} className="chat-prompt-icon" />
                      <span className="chat-prompt-title">{title}</span>
                    </div>
                    <p className="chat-prompt-text">{prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages-list">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message-row chat-message-row--${msg.role}`}>
                  <div className={`chat-bubble chat-bubble--${msg.role}`}>
                    <div className="chat-bubble-body">
                      {msg.role === 'assistant' ? (
                        <MarkdownRenderer content={msg.content} sources={msg.sources} onSelectView={onSelectView} onOpenNoteFolder={onOpenNoteFolder} />
                      ) : (
                        <p className="chat-text-line">{msg.content}</p>
                      )}
                    </div>

                    {msg.role === 'assistant' && msg.sources && msg.sources.filter(Boolean).length > 0 && (
                      <div className="chat-sources-block">
                        <div className="chat-sources-header">
                          <BookOpen size={12} />
                          <span>Sources from library:</span>
                        </div>
                        <div className="chat-sources-list">
                          {msg.sources.filter(Boolean).map((s, j) => {
                            const isNote = s.type === 'note' || !s.url || s.url === '#' || s.url.startsWith('#')
                            const realFolder = s.folder || (s.category && s.category !== 'Note' ? s.category : null)
                            if (isNote) {
                              return (
                                <button
                                  key={j}
                                  type="button"
                                  onClick={() => {
                                    const targetNoteOrFolder = s.title || s.id || realFolder
                                    if (targetNoteOrFolder && onOpenNoteFolder) {
                                      onOpenNoteFolder(targetNoteOrFolder)
                                    } else {
                                      onSelectView?.('notes')
                                    }
                                  }}
                                  className="chat-source-card cursor-pointer border-none"
                                  title={`Open Note: ${s.title}`}
                                >
                                  <span className="chat-source-title">{s.title}</span>
                                  <FileText size={12} className="chat-source-ext text-[var(--accent-crimson)]" />
                                </button>
                              )
                            }
                            return (
                              <a
                                key={j}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat-source-card"
                                title={`Open Link: ${s.title}`}
                              >
                                <span className="chat-source-title">{s.title}</span>
                                <ExternalLink size={12} className="chat-source-ext" />
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ChatGPT Style Message Actions */}
                    <div className="chat-message-actions">
                      <button
                        type="button"
                        className="chat-action-btn"
                        onClick={() => handleCopy(msg.content, i)}
                        title="Copy text"
                        aria-label="Copy text"
                      >
                        {copiedIndex === i ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      {msg.role === 'user' && (
                        <button
                          type="button"
                          className="chat-action-btn"
                          onClick={() => setInput(msg.content)}
                          title="Edit prompt"
                          aria-label="Edit prompt"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          className="chat-action-btn"
                          onClick={() => {
                            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
                            if (lastUserMsg) handleSend(lastUserMsg.content)
                          }}
                          title="Regenerate response"
                          aria-label="Regenerate response"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="chat-message-row chat-message-row--assistant">
                  <div className="chat-bubble chat-bubble--assistant chat-bubble--loading">
                    <div className="chat-typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Floating Input Dock */}
      <div className="chat-input-dock">
        <div className="chat-max-width">
          <div className="chat-input-shell">
            <button
              type="button"
              className="chat-input-plus-btn"
              title="Add attachment or action"
              aria-label="Add attachment"
            >
              <Plus size={18} />
            </button>
            <input
              type="text"
              className="chat-input-field"
              placeholder={links.length === 0 ? 'Save some links first to chat…' : 'Ask anything about your saved links…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleChatKey}
              disabled={chatLoading || links.length === 0}
            />
            <button
              type="button"
              className="chat-submit-btn"
              onClick={() => handleSend()}
              disabled={chatLoading || !input.trim() || links.length === 0}
              aria-label="Send message"
            >
              {chatLoading ? (
                <div className="save-btn-spinner" />
              ) : (
                <ArrowUp size={16} strokeWidth={2.5} />
              )}
            </button>
          </div>
          <p className="chat-footer-note">
            AI responses are generated strictly from your saved library content.
          </p>
        </div>
      </div>
    </div>
  )
}
