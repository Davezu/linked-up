import { useState, useRef, useEffect } from 'react'
import { Sparkles, AlertCircle, Info, Sun, Moon } from 'lucide-react'
import './App.css'

import type { LinkRecord } from './types'
import { API_BASE, AI_API_BASE, LOAD_FROM_API, STATUS_FILTERS } from './lib/constants'
import { generateId, delay } from './lib/helpers'
import { loadLinks, saveLinks, normalizeCategory, recordDeletedId, removeDeletedId, getDeletedIds } from './lib/storage'
import { apiMutate, fetchLinksFromApi, buildRecordFromAi } from './lib/api'
import { makeMockRecord } from './lib/mock'

import { FilterPillList } from './components/FilterPillList'
import { MobileBottomNav } from './components/MobileBottomNav'
import { ChatView } from './components/ChatView'
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog'
import { LinkCard } from './components/LinkCard'
import { LinkFan } from './components/LinkFan'

import { hasToken, authHeaders } from './lib/auth/tokenStorage'
import { AuthGate } from './components/AuthGate'

//  Main App
export default function App() {
  const [url, setUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeView, setActiveView] = useState<'library' | 'chat'>('library')
  const [links, setLinks] = useState<LinkRecord[]>(loadLinks)
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lo-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  // Fetch from backend on load (falls back to localStorage if API list route is unavailable)
  useEffect(() => {
    if (!API_BASE || !LOAD_FROM_API || !authenticated) return

    const ctrl = new AbortController()
    setLoading(true)
    fetchLinksFromApi(ctrl.signal)
      .then(data => {
        if (data && data.length > 0) {
          const deleted = getDeletedIds()
          const validData = data.filter(l => l && l.id && !deleted.has(l.id))
          setLinks(validData.map(l => ({ ...l, category: normalizeCategory(l.category) })))
        }
      })
      .finally(() => setLoading(false))

    return () => ctrl.abort()
  }, [authenticated])

  useEffect(() => { saveLinks(links) }, [links])

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
    fetch(`${AI_API_BASE}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(meta => {
        if (meta) {
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
      // returned empty/generic fallbacks so the card never regresses to "undefined".
      const currentCard = links.find(l => l.id === placeholderId)
      const mergedTitle = (aiData.title && aiData.title !== `Link from ${new URL(trimmed).hostname}`) ? aiData.title : (currentCard?.title || aiData.title || trimmed)
      const mergedImage = aiData.image || currentCard?.image || null
      const mergedDesc  = (aiData.description && aiData.description !== 'Metadata could not be extracted (site may block scrapers).') ? aiData.description : (currentCard?.description || aiData.description || '')

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
    recordDeletedId(id)
    setLinks(prev => prev.filter(l => l.id !== id))
    const ok = await apiMutate({
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (ok) {
      removeDeletedId(id)
    }
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
  const toWatchCount = links.filter(l => l.status === 'To Watch' || !l.status).length
  const finishedCount = links.filter(l => l.status === 'Finished').length
  const favoriteCount = links.filter(l => l.status === 'Favorite').length
  const allCategories = Array.from(new Set(links.map(l => l.category))).sort()
  const filterPills = [...STATUS_FILTERS, ...allCategories]

  if (!authenticated) {
    return <AuthGate onSuccess={() => setAuthenticated(true)} />
  }
  return (
    <div className="flex h-screen w-full overflow-hidden items-stretch app-layout">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 h-screen w-60 flex-shrink-0 border-r border-[var(--border)] p-6 flex flex-col gap-6 bg-[var(--bg-sidebar)] sidebar" aria-label="Library navigation">
        <div className="flex flex-col gap-2 sidebar-section">
          <div className="font-[family-name:var(--font-display)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2 pl-2 sidebar-title">Library</div>
          {STATUS_FILTERS.map(f => {
            const count = f === 'All' ? links.length : f === 'To Watch' ? toWatchCount : f === 'Finished' ? finishedCount : favoriteCount
            return (
              <div
                key={f}
                role="button"
                tabIndex={0}
                className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all sidebar-item nav-tab ${activeView === 'library' && activeFilter === f ? 'active' : ''}`}
                onClick={() => { setActiveView('library'); setActiveFilter(f) }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('library'); setActiveFilter(f) } }}
              >
                <span>{f}</span>
                <span className="text-[11px] bg-[var(--badge-bg)] px-2 py-0.5 rounded-full text-[var(--text-muted)] font-semibold sidebar-badge">{count}</span>
              </div>
            )
          })}
        </div>

        {allCategories.length > 0 && (
          <div className="flex flex-col gap-2 sidebar-section">
            <div className="font-[family-name:var(--font-display)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2 pl-2 sidebar-title">Categories</div>
            {allCategories.map(cat => {
              const count = links.filter(l => l.category === cat).length
              return (
                <div
                  key={cat}
                  role="button"
                  tabIndex={0}
                  className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all sidebar-item nav-tab ${activeView === 'library' && activeFilter === cat ? 'active' : ''}`}
                  onClick={() => { setActiveView('library'); setActiveFilter(cat) }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('library'); setActiveFilter(cat) } }}
                >
                  <span>{cat}</span>
                  <span className="text-[11px] bg-[var(--badge-bg)] px-2 py-0.5 rounded-full text-[var(--text-muted)] font-semibold sidebar-badge">{count}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[var(--border)] sidebar-section sidebar-bottom">
          <div
            role="button"
            tabIndex={0}
            className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all sidebar-item nav-tab ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveView('chat')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('chat') } }}
          >
            <span className="flex items-center gap-2 nav-tab-label">
              <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
              Ask AI
            </span>
            <span className="text-[9px] bg-[var(--beta-badge-bg)] text-[var(--text-main)] px-2 py-0.5 rounded-full font-bold tracking-wider sidebar-badge beta-badge">AI</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 h-screen p-6 flex flex-col gap-4 min-w-0 min-h-0 overflow-hidden app">
        {/* Header */}
        <header className="flex-shrink-0 flex flex-col gap-3 pb-4 relative header">
          <div className="flex justify-between items-start w-full header-top">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center gap-3 header-brand">
                <img src="/logo.svg" alt="Knowledge Vault" className="w-8 h-8 object-contain flex-shrink-0 header-logo" />
                {activeView === 'chat' ? (
                  <>
                    <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight leading-tight header-title">Ask AI</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1 font-normal header-subtitle">Chat with your saved links</div>
                  </>
                ) : (
                  <>
                    <div className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight leading-tight header-title">Knowledge Vault</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1 font-normal header-subtitle">Save links — AI classifies them.</div>
                  </>
                )}
              </div>
            </div>
            <button
              className="p-2 rounded-xl bg-[var(--toggle-bg)] hover:bg-[var(--toggle-bg-hover)] text-[var(--text-main)] transition-all cursor-pointer theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </button>
          </div>

          {activeView === 'library' && (
            <div className="flex items-center justify-between gap-3 w-full header-actions">
              <input
                type="search"
                className="bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] rounded-xl px-3.5 py-2.5 text-sm w-48 h-10 transition-all search-input"
                placeholder="Search links..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="text-xs text-[var(--text-dim)] font-medium whitespace-nowrap header-count">
                {filteredLinks.length} {filteredLinks.length === 1 ? 'link' : 'links'}
                {searchQuery ? ' found' : ' saved'}
              </div>
            </div>
          )}
        </header>

        {activeView === 'chat' ? (
          <ChatView links={links} />
        ) : (
          <>
            {/* Mobile: sticky horizontal filter pills */}
            <FilterPillList
              filters={filterPills}
              activeFilter={activeFilter}
              onSelect={setActiveFilter}
            />

            {/* Input zone */}
            <section className="flex-shrink-0 input-zone" aria-label="Add a new link">
              <label htmlFor="url-input" className="hidden input-label">Paste a link</label>
              <div className={`flex gap-2 bg-[var(--bg-input)] border border-[var(--border)] p-1.5 rounded-xl transition-all input-row ${error ? 'border-[var(--color-destructive-border)] input-row--error' : ''}`}>
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
                  className="bg-[var(--gradient-accent)] text-[var(--color-bg)] font-semibold text-xs px-4.5 rounded-lg flex items-center gap-1.5 min-h-[30px] shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed save-btn"
                  onClick={handleSave}
                  disabled={isProcessing || !url.trim()}
                  aria-label="Save link"
                >
                  {isProcessing
                    ? <><div className="save-btn-spinner" /><span>Processing…</span></>
                    : <><span>Save</span><span style={{ fontSize: 16 }}>→</span></>
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
                  <span>
                    Demo mode — links are classified locally and stored in your browser.
                  </span>
                </p>
              )}
            </section>

            {/*  Link list */}
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
