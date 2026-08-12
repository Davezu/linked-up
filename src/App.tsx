import { useState, useRef, useEffect } from 'react'
import { Sparkles, AlertCircle, Info } from 'lucide-react'
import './App.css'

import type { LinkRecord, NoteRecord } from './types'
import { API_BASE, AI_API_BASE, LOAD_FROM_API, STATUS_FILTERS } from './lib/constants'
import { generateId, delay } from './lib/helpers'
import { loadLinks, saveLinks, normalizeCategory, loadNotes, saveNotes, DELETED_IDS_KEY, recordDeletedId, getDeletedIds } from './lib/storage'
import { apiMutate, fetchLinksFromApi, buildRecordFromAi } from './lib/api'
import { fetchNotesFromApi } from './lib/notes-api'
import { makeMockRecord } from './lib/mock'

import { MobileBottomNav } from './components/MobileBottomNav'
import { ChatView } from './components/ChatView'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog'
import { LinkCard } from './components/LinkCard'
import { LinkFan } from './components/LinkFan'
import { NotesView } from './components/NotesView'
import { TopNav } from './components/TopNav'

import { hasToken, authHeaders } from './lib/auth/tokenStorage'
import { AuthGate } from './components/AuthGate'
import { isColorPalette, type ColorPalette } from './lib/palettes'
import { runThemeToggleAnimation } from './components/react-bits/themeTransition'

type AppView = 'library' | 'notes' | 'chat'

//  Main App
export default function App() {
  const [url, setUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeView, setActiveView] = useState<AppView>('library')
  const [links, setLinks] = useState<LinkRecord[]>(loadLinks)
  const [notes, setNotes] = useState<NoteRecord[]>(loadNotes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LinkRecord | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [authenticated, setAuthenticated] = useState(hasToken())

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('lo-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  const [palette, setPalette] = useState<ColorPalette>(() => {
    const stored = localStorage.getItem('lo-palette')
    if (stored && isColorPalette(stored)) return stored
    return 'velvet'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-palette', palette)
    localStorage.setItem('lo-theme', theme)
    localStorage.setItem('lo-palette', palette)
  }, [theme, palette])

  function handleToggleTheme(originEl: HTMLElement | null) {
    runThemeToggleAnimation(originEl, () => {
      setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
    })
  }


  // Fetch links from backend on auth — filter out local tombstones
  useEffect(() => {
    if (!API_BASE || !LOAD_FROM_API || !authenticated) return

    const ctrl = new AbortController()
    setLoading(true)
    fetchLinksFromApi(ctrl.signal)
      .then(data => {
        if (data) {
          const deleted = getDeletedIds()
          setLinks(data.filter(l => l && l.id && !deleted.has(l.id)).map(l => ({ ...l, category: normalizeCategory(l.category) })))
        }
      })
      .finally(() => setLoading(false))

    return () => ctrl.abort()
  }, [authenticated])

  // Fetch notes from backend on auth
  useEffect(() => {
    if (!API_BASE || !LOAD_FROM_API || !authenticated) return

    const ctrl = new AbortController()
    fetchNotesFromApi(ctrl.signal)
      .then(data => { if (data) setNotes(data) })

    return () => ctrl.abort()
  }, [authenticated])

  useEffect(() => { saveLinks(links) }, [links])
  useEffect(() => { saveNotes(notes) }, [notes])

  // Cross-tab tombstone sync for notes
  useEffect(() => {
    function handleStorageSync(e: StorageEvent) {
      if (e.key !== DELETED_IDS_KEY) return
      // Re-load notes from localStorage (which already filters tombstones via loadNotes)
      setNotes(loadNotes())
    }
    window.addEventListener('storage', handleStorageSync)
    return () => window.removeEventListener('storage', handleStorageSync)
  }, [])

  useEffect(() => {
    if (links.some(l => l.isNew)) {
      const t = setTimeout(() => setLinks(prev => prev.map(l => ({ ...l, isNew: false }))), 600)
      return () => clearTimeout(t)
    }
  }, [links])


  // Save link
  async function handleSave() {
    const trimmed = url.trim()
    if (!trimmed) return
    try { new URL(trimmed) } catch {
      setError('Please enter a valid URL (include https://)'); return
    }
    setError(null); setNotice(null);
    setUrl('')

    // Generate a local ID for optimistic insert
    const placeholderId = generateId()
    let hostname = trimmed
    try { hostname = new URL(trimmed).hostname.replace(/^www\./, '') } catch { /* keep trimmed */ }

    if (!API_BASE) {
      setLoading(true)
      await delay(1500)
      const mockRecord = makeMockRecord(trimmed)
      setLinks(prev => [{ ...mockRecord, isNew: true }, ...prev])
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    // Optimistic insert — card appears instantly with skeleton state
    const placeholder: LinkRecord = {
      id: placeholderId,
      url: trimmed,
      title: hostname,
      description: 'Analyzing content…',
      image: null,
      category: '⏳ Processing',
      summary: '',
      tags: [],
      created_at: new Date().toISOString(),
      status: 'To Watch',
      isNew: true,
      processing: true,
    }
    setLinks(prev => [placeholder, ...prev])
    inputRef.current?.focus()

    // Fast metadata fetch — gets Open Graph image & title immediately (~300ms)
    const fastMeta: { title?: string; image?: string | null; description?: string } = {}

    fetch(`${AI_API_BASE}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(meta => {
        if (meta) {
          Object.assign(fastMeta, meta)
          setLinks(prev =>
            prev.map(l =>
              l.id === placeholderId
                ? {
                  ...l,
                  title: meta.title || l.title,
                  description: meta.description && meta.description !== 'Metadata could not be extracted (site may block scrapers).' ? meta.description : l.description,
                  image: meta.image || l.image,
                }
                : l
            )
          )
        }
      })
      .catch(err => console.warn('[App] Fast metadata fetch warning:', err))

    // Background processing — full AI classification (~2s)
    try {
      const aiResponse = await fetch(`${AI_API_BASE}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (!aiResponse.ok) {
        const body = await aiResponse.json().catch(() => ({}))
        throw new Error(body?.error ?? `AI Server error ${aiResponse.status}`)
      }
      const aiData = await aiResponse.json()

      // Merge aiData with the existing card: keep fast-metadata values if aiData
      // returned empty/generic fallbacks so the card never regresses.
      const mergedTitle = (aiData.title && aiData.title !== `Link from ${new URL(trimmed).hostname}`) ? aiData.title : (fastMeta.title || aiData.title || trimmed)
      const mergedImage = aiData.image || fastMeta.image || null
      const mergedDesc = (aiData.description && aiData.description !== 'Metadata could not be extracted (site may block scrapers).') ? aiData.description : (fastMeta.description || aiData.description || '')

      const payload = {
        url: trimmed,
        title: mergedTitle,
        description: mergedDesc,
        image: mergedImage,
        category: normalizeCategory(aiData.category),
        summary: aiData.summary || '',
        tags: aiData.tags || [],
        provider: aiData.provider,
        status: 'To Watch',
      }

      const awsResponse = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })

      if (!awsResponse.ok) {
        // AWS failed — keep card with merged data locally
        const mergedAiData = { ...aiData, title: mergedTitle, image: mergedImage, description: mergedDesc }
        const localRecord: LinkRecord = { ...buildRecordFromAi(trimmed, mergedAiData, placeholderId), isNew: true, processing: false }
        setLinks(prev => prev.map(l => l.id === placeholderId ? localRecord : l))
        const body = await awsResponse.json().catch(() => ({}))
        const apiMessage = typeof body?.message === 'string' ? body.message : null
        if (awsResponse.status >= 500) {
          setNotice(apiMessage
            ? `Saved locally — cloud sync failed: ${apiMessage}`
            : 'Saved but in local.')
        } else {
          setNotice(apiMessage ?? `Saved locally — cloud sync returned ${awsResponse.status}.`)
        }
        return
      }

      const result = await awsResponse.json()
      const record = result.record || result

      // Replace placeholder with final record — merge to keep best title/image
      setLinks(prev => prev.map(l => l.id === placeholderId ? {
        ...record,
        title: record.title || mergedTitle,
        image: record.image || mergedImage,
        description: record.description || mergedDesc,
        isNew: true,
        processing: false,
      } : l))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      // Update placeholder to show error state but keep the card
      setLinks(prev => prev.map(l => l.id === placeholderId ? {
        ...l,
        description: 'Failed to process — tap to retry',
        category: '⚠️ Error',
        processing: false,
      } : l))
      setError(message)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSave()
  }

  function requestDelete(id: string) {
    const link = links.find(l => l.id === id)
    if (link) setDeleteTarget(link)
  }

  function cancelDelete() {
    setDeleteTarget(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    recordDeletedId(id) // Save tombstone locally so link never comes back!
    setLinks(prev => prev.filter(l => l.id !== id))
    await apiMutate({
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    await apiMutate({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  // Filter & group
  const filteredLinks = links.filter(l => {
    if (activeFilter === 'To Watch') { if (l.status !== 'To Watch' && !!l.status) return false }
    else if (activeFilter === 'Finished') { if (l.status !== 'Finished') return false }
    else if (activeFilter === 'Favorites') { if (l.status !== 'Favorite') return false }
    else if (activeFilter !== 'All') { if (l.category !== activeFilter) return false }
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (l.title && l.title.toLowerCase().includes(q)) ||
      (l.summary && l.summary.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q)) ||
      (l.tags && l.tags.some(t => t.toLowerCase().includes(q)))
    )
  })

  const uniqueCategories = Array.from(new Set(filteredLinks.map(l => l.category))).sort()
  const grouped = uniqueCategories.map(catName => ({
    name: catName,
    items: filteredLinks.filter(l => l.category === catName),
  }))

  const isProcessing = loading
  const allCategories = Array.from(new Set(links.map(l => l.category))).sort()

  if (!authenticated) {
    return <AuthGate onSuccess={() => setAuthenticated(true)} />
  }
  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <TopNav
        activeView={activeView}
        onViewChange={v => { setActiveView(v) }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        notesCount={notes.length}
        linksCount={links.length}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        statusFilters={STATUS_FILTERS}
        categories={allCategories}
        filterLinks={links}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        palette={palette}
        onPaletteChange={setPalette}
        onNewClick={() => { /* wire up your "create new" action here */ }}
        onNotificationsClick={() => { /* wire up notifications here */ }}
        onAssistantClick={() => { /* wire up assistant panel here */ }}
      />

      {/* Page body */}
      <div className="app-body">

        {/* Main content */}
        <div className={`app-content${activeView === 'notes' ? ' app-content--canvas' : ''}`}>
          {activeView === 'chat' ? (
            <ChatView links={links} />
          ) : activeView === 'notes' ? (
            <NotesView notes={notes} onNotesChange={setNotes} />
          ) : (
            <>
              {/* URL Input zone */}
              <section className="flex-shrink-0 input-zone" aria-label="Add a new link">
                <label htmlFor="url-input" className="hidden input-label">Paste a link</label>
                <div className={`input-row${error ? ' input-row--error' : ''}`}>
                  <input
                    id="url-input"
                    ref={inputRef}
                    type="url"
                    className="flex-1 text-[var(--text-main)] bg-transparent text-xs px-3 py-2 outline-none url-input"
                    placeholder="https://tiktok.com/@… or any link"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError(null); setNotice(null) }}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'url-error' : undefined}
                  />
                  <button
                    id="save-link-btn"
                    className="text-[var(--color-bg)] font-semibold text-xs px-4.5 rounded-lg flex items-center gap-1.5 min-h-[30px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed save-btn"
                    onClick={handleSave}
                    disabled={isProcessing || !url.trim()}
                    aria-label="Save link"
                  >
                    {isProcessing
                      ? <><div className="save-btn-spinner" /><span>Processing…</span></>
                      : <><span>Save Link</span><span style={{ fontSize: 16 }}>→</span></>
                    }
                  </button>
                </div>

                {error && (
                  <p id="url-error" className="flex items-start gap-2 m-0 text-xs text-[var(--color-destructive-text)] mt-1.5 field-error" role="alert">
                    <AlertCircle size={15} strokeWidth={2} aria-hidden="true" className="flex-shrink-0 mt-0.5 text-[var(--color-destructive)] field-error-icon" />
                    <span>
                      {error}
                      {!API_BASE && (
                        <span className="text-[var(--text-dim)] field-error-detail">
                          {' '}Running in demo mode — set <code>VITE_API_BASE=/api</code> in <code>.env.local</code> to connect your backend.
                        </span>
                      )}
                    </span>
                  </p>
                )}

                {notice && (
                  <p className="flex items-start gap-2 m-0 text-xs text-[var(--text-dim)] mt-1.5 field-note" role="status">
                    <Info size={15} strokeWidth={2} aria-hidden="true" className="flex-shrink-0 mt-0.5 text-[var(--text-muted)] field-note-icon" />
                    <span>{notice}</span>
                  </p>
                )}

                {!API_BASE && !error && !notice && !isProcessing && (
                  <p className="flex items-start gap-2 m-0 text-xs text-[var(--text-dim)] mt-1.5 field-note" role="note">
                    <Info size={15} strokeWidth={2} aria-hidden="true" className="flex-shrink-0 mt-0.5 text-[var(--text-muted)] field-note-icon" />
                    <span>Demo mode — links are classified locally and stored in your browser.</span>
                  </p>
                )}
              </section>

              {/* Link list */}
              <main className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-6 main">
                {filteredLinks.length === 0 && !isProcessing ? (
                  <div className="text-center py-16 flex flex-col items-center gap-3 empty-state">
                    <div className="text-4xl opacity-20 mb-2 empty-icon">{activeFilter !== 'All' ? '🔍' : '📭'}</div>
                    {activeFilter !== 'All' ? (
                      <>
                        <h1 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--text-main)] empty-title">Nothing in {activeFilter}</h1>
                        <p className="text-xs text-[var(--text-dim)] max-w-[360px] leading-relaxed empty-desc">
                          No links are categorized here yet. Paste a link above and AI will sort it automatically.
                        </p>
                      </>
                    ) : (
                      <>
                        <h1 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--text-main)] empty-title">Your vault is empty</h1>
                        <p className="text-xs text-[var(--text-dim)] max-w-[360px] leading-relaxed empty-desc">
                          Paste any link above — YouTube, Reddit, TikTok, articles — and AI will classify and organize it for you.
                        </p>
                      </>
                    )}
                  </div>
                ) : activeFilter !== 'All' ? (
                  <div className="flex flex-col gap-4 w-full filtered-vertical-list">
                    <div className="category-header">
                      <span className="category-name">{activeFilter}</span>
                      <span className="category-badge">{filteredLinks.length}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 w-full vertical-cards-stack">
                      {filteredLinks.map(link => (
                        <LinkCard
                          key={link.id}
                          link={link}
                          allLinks={links}
                          onDelete={requestDelete}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-6 content-start categories-grid">
                    {grouped.map(group => (
                      <section key={group.name} className="flex flex-col gap-0.5 category-group" aria-label={group.name}>
                        <div className="category-header">
                          <span className="category-name">{group.name}</span>
                          <span className="category-badge">{group.items.length}</span>
                        </div>
                        <LinkFan
                          items={group.items}
                          allLinks={links}
                          onDelete={requestDelete}
                          onStatusChange={handleStatusChange} />
                      </section>
                    ))}
                  </div>
                )}
              </main>
            </>
          )}
        </div>

        {/* AI Chat floating action button (visible in library + notes views) */}
        {activeView !== 'chat' && (
          <button
            id="ai-chat-fab"
            className="ai-chat-fab"
            onClick={() => setActiveView('chat')}
            aria-label="Ask AI about your library"
            title="Ask AI"
          >
            <Sparkles size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>

      <MobileBottomNav activeView={activeView} onViewChange={setActiveView} />

      {deleteTarget && (
        <DeleteConfirmDialog
          link={deleteTarget}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}