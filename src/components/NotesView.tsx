import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Tag, X, Search, ZoomIn, ZoomOut, Save, Edit3 } from 'lucide-react'
import type { NoteRecord } from '../types'
import { generateId } from '../lib/helpers'
import { createNoteApi, updateNoteApi, deleteNoteApi } from '../lib/notes-api'
import { recordDeletedId, removeDeletedId } from '../lib/storage'

interface NotesViewProps {
  notes: NoteRecord[]
  onNotesChange: (updater: (prev: NoteRecord[]) => NoteRecord[]) => void
}

export const MAX_CONTENT_LENGTH = 1000
export const MAX_TITLE_LENGTH = 80

export const NOTE_PALETTE = [
  { id: 'yellow', bg: '#fff59d', gradient: 'linear-gradient(175deg, #fff9c4 0%, #fff176 100%)', label: 'Canary Yellow' },
  { id: 'cyan', bg: '#e0f2fe', gradient: 'linear-gradient(175deg, #f0f9ff 0%, #bae6fd 100%)', label: 'Sky Blue' },
  { id: 'green', bg: '#dcfce7', gradient: 'linear-gradient(175deg, #f0fdf4 0%, #bbf7d0 100%)', label: 'Mint Green' },
  { id: 'pink', bg: '#fde8f4', gradient: 'linear-gradient(175deg, #fff1f2 0%, #fbcfe8 100%)', label: 'Pastel Pink' },
  { id: 'lavender', bg: '#f3e8ff', gradient: 'linear-gradient(175deg, #faf5ff 0%, #e9d5ff 100%)', label: 'Lavender' },
  { id: 'peach', bg: '#ffedd5', gradient: 'linear-gradient(175deg, #fff7ed 0%, #fed7aa 100%)', label: 'Warm Peach' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function deriveTitle(content: string): string {
  return content.split('\n').find(l => l.trim())?.slice(0, 60) ?? 'Untitled'
}

function noteRotation(id: string) {
  const charCode = id.charCodeAt(id.length - 1) % 5
  return [-2.5, -1.2, 0.5, 1.5, 2.5][charCode]
}

// 3D Pushpin Component
function PushPinSVG() {
  return (
    <div className="postit-pin" aria-hidden="true">
      <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Drop shadow on paper */}
        <ellipse cx="14" cy="18" rx="8" ry="3" fill="rgba(0,0,0,0.3)" filter="blur(1px)" />
        {/* Needle shaft */}
        <rect x="13" y="18" width="2" height="16" rx="1" fill="#a0a0a0" />
        <rect x="13.2" y="19" width="0.7" height="14" fill="rgba(255,255,255,0.7)" />
        {/* Needle tip */}
        <path d="M13 34L14 37L15 34Z" fill="#777777" />
        {/* Pin base shadow */}
        <circle cx="14" cy="12" r="10" fill="#7a000d" />
        {/* Main pin sphere fill */}
        <circle cx="14" cy="11" r="9" fill="#e61c24" />
        {/* Radial highlight for 3D sphere depth */}
        <circle cx="14" cy="11" r="9" fill="url(#pinGrad)" />
        {/* Specular highlight */}
        <ellipse cx="11" cy="7.5" rx="3.5" ry="2.2" fill="rgba(255,255,255,0.85)" transform="rotate(-25 11 7.5)" />
        <circle cx="10" cy="6.5" r="1" fill="#ffffff" />
        <defs>
          <radialGradient id="pinGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  )
}

const CARD_W = 200
const CARD_H = 200
const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

export function NotesView({ notes, onNotesChange }: NotesViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftColor, setDraftColor] = useState<string>(NOTE_PALETTE[0].bg)
  const [tagInput, setTagInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Canvas pan & zoom state
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)

  // Drag-note state
  const dragRef = useRef<{
    noteId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  // Pan-canvas state (drag on empty space)
  const panRef = useRef<{
    startX: number
    startY: number
    origPanX: number
    origPanY: number
  } | null>(null)

  const currentNote = editingId ? notes.find(n => n.id === editingId) ?? null : null

  // Close modal on Escape
  useEffect(() => {
    if (!editingId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingId])

  // ── Zoom with Ctrl+Scroll ─────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)))
      } else {
        setPanX(prev => prev - e.deltaX)
        setPanY(prev => prev - e.deltaY)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Canvas pan (drag on empty space) ───────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('.postit-note')) return
    if (e.button !== 0) return

    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPanX: panX,
      origPanY: panY,
    }
  }

  function handleCanvasPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX
      const dy = e.clientY - panRef.current.startY
      setPanX(panRef.current.origPanX + dx)
      setPanY(panRef.current.origPanY + dy)
      return
    }

    if (dragRef.current) {
      e.preventDefault()
      const { noteId, startX, startY, origX, origY } = dragRef.current
      const dx = (e.clientX - startX) / zoom
      const dy = (e.clientY - startY) / zoom
      const newX = origX + dx
      const newY = origY + dy

      onNotesChange(prev => prev.map(n =>
        n.id === noteId ? { ...n, x: newX, y: newY } : n
      ))
    }
  }

  function handleCanvasPointerUp(e: React.PointerEvent) {
    if (panRef.current) {
      panRef.current = null
      return
    }

    if (dragRef.current) {
      const { noteId, startX, startY } = dragRef.current
      dragRef.current = null
      const dx = Math.abs(e.clientX - startX)
      const dy = Math.abs(e.clientY - startY)
      if (dx < 5 && dy < 5) {
        const note = notes.find(n => n.id === noteId)
        if (note) openNote(note)
      }
    }
  }

  // Note drag
  function handleNotePointerDown(e: React.PointerEvent, note: NoteRecord) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.postit-hover-actions')) return
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)

    dragRef.current = {
      noteId: note.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: note.x ?? 0,
      origY: note.y ?? 0,
    }
  }

  // Note CRUD
  function openNote(note: NoteRecord) {
    setEditingId(note.id)
    setDraftContent(note.content)
    setDraftTitle(note.title)
    setDraftTags(note.tags.join(', '))
    setDraftColor(note.color || NOTE_PALETTE[0].bg)
    setTagInput('')
  }

  function closeEditor() {
    if (editingId) {
      const note = notes.find(n => n.id === editingId)
      if (note?.isNew) {
        onNotesChange(prev => prev.filter(n => n.id !== editingId))
      }
    }
    setEditingId(null)
    setIsSaving(false)
  }

  async function handleSave() {
    if (!editingId || isSaving) return
    setIsSaving(true)
    const id = editingId
    const isNew = notes.find(n => n.id === id)?.isNew
    const now = new Date().toISOString()
    const resolvedTitle = draftTitle.trim() || deriveTitle(draftContent)
    const resolvedTags = parseTags(draftTags)

    onNotesChange(prev => prev.map(n =>
      n.id === id
        ? {
          ...n,
          content: draftContent,
          title: resolvedTitle,
          tags: resolvedTags,
          color: draftColor,
          updated_at: now,
          isNew: false
        }
        : n
    ))

    if (isNew) {
      const remote = await createNoteApi({ content: draftContent, title: resolvedTitle, tags: resolvedTags })
      if (remote) {
        onNotesChange(prev => prev.map(n => n.id === id ? { ...remote, x: n.x, y: n.y, color: draftColor, isNew: false } : n))
      }
    } else {
      await updateNoteApi(id, { content: draftContent, title: resolvedTitle, tags: resolvedTags })
    }

    setEditingId(null)
    setIsSaving(false)
  }

  function parseTags(raw: string): string[] {
    return raw.split(',').map(t => t.trim()).filter(Boolean)
  }

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    const existing = parseTags(draftTags)
    if (existing.includes(tag)) return
    const next = [...existing, tag].join(', ')
    setDraftTags(next)
    setTagInput('')
  }

  function removeTag(tag: string) {
    const next = parseTags(draftTags).filter(t => t !== tag).join(', ')
    setDraftTags(next)
  }

  function handleNewNote() {
    const tempId = generateId()
    const now = new Date().toISOString()

    const centerX = (-panX + (canvasRef.current?.clientWidth ?? 800) / 2) / zoom
    const centerY = (-panY + (canvasRef.current?.clientHeight ?? 600) / 2) / zoom
    const jitterX = (Math.random() - 0.5) * 100
    const jitterY = (Math.random() - 0.5) * 100

    const randomColor = NOTE_PALETTE[Math.floor(Math.random() * NOTE_PALETTE.length)].bg

    const newNote: NoteRecord = {
      id: tempId,
      title: '',
      content: '',
      tags: [],
      color: randomColor,
      created_at: now,
      updated_at: now,
      isNew: true,
      x: centerX - CARD_W / 2 + jitterX,
      y: centerY - CARD_H / 2 + jitterY,
    }
    onNotesChange(prev => [newNote, ...prev])
    openNote(newNote)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function handleDelete(id: string) {
    setDeleteTarget(null)
    if (editingId === id) setEditingId(null)
    recordDeletedId(id)
    onNotesChange(prev => prev.filter(n => n.id !== id))
    const ok = await deleteNoteApi(id)
    if (ok) removeDeletedId(id)
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) { setHighlightId(null); return }
    const q = query.toLowerCase()
    const found = notes.find(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    )
    if (found) {
      setHighlightId(found.id)
      if (found.x != null && found.y != null) {
        const cw = canvasRef.current?.clientWidth ?? 800
        const ch = canvasRef.current?.clientHeight ?? 600
        setPanX(-(found.x * zoom) + cw / 2)
        setPanY(-(found.y * zoom) + ch / 2)
      }
    } else {
      setHighlightId(null)
    }
  }

  function handleZoomIn() {
    setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  }
  function handleZoomOut() {
    setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  }
  function handleResetView() {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  const tags = parseTags(draftTags)
  const zoomPercent = Math.round(zoom * 100)
  const isNearLimit = draftContent.length >= MAX_CONTENT_LENGTH * 0.9

  return (
    <div className="excalidraw-canvas-wrap">
      {/* The canvas */}
      <div
        ref={canvasRef}
        className="excalidraw-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      >
        <div
          className="excalidraw-canvas-inner"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {notes.length === 0 && (
            <div className="canvas-empty-hint" style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }}>
              <div style={{ fontSize: '3rem', opacity: 0.25 }}>📌</div>
              <p style={{ fontSize: '1.1rem', fontFamily: "'Patrick Hand', cursive", fontWeight: 600, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                Click "+ New Note" to pin a thought on your board
              </p>
            </div>
          )}

          {notes.map((note, idx) => {
            const noteColorObj = NOTE_PALETTE.find(p => p.bg === note.color) || NOTE_PALETTE[idx % NOTE_PALETTE.length]
            const noteColor = noteColorObj.bg
            const noteGradient = noteColorObj.gradient
            const rotation = noteRotation(note.id)
            const displayTitle = note.title || deriveTitle(note.content) || 'Untitled'
            const isHighlighted = highlightId === note.id
            const posX = note.x ?? 100 + (idx % 4) * (CARD_W + 24)
            const posY = note.y ?? 100 + Math.floor(idx / 4) * (CARD_H + 24)

            return (
              <div
                key={note.id}
                className={`postit-note ${isHighlighted ? 'postit-note--highlight' : ''}`}
                style={{
                  left: posX,
                  top: posY,
                  width: CARD_W,
                  minHeight: CARD_H,
                  background: noteGradient || noteColor,
                  transform: `rotate(${rotation}deg)`,
                }}
                onPointerDown={e => handleNotePointerDown(e, note)}
                role="button"
                tabIndex={0}
                aria-label={`Note: ${displayTitle}. Drag to move.`}
              >
                {/* 3D Red Push-pin */}
                <PushPinSVG />

                {/* Hover Quick Action Buttons */}
                <div className="postit-hover-actions">
                  <button
                    className="postit-hover-btn"
                    onClick={(e) => { e.stopPropagation(); openNote(note) }}
                    title="Edit note"
                    aria-label="Edit note"
                  >
                    <Edit3 size={11} />
                  </button>
                  <button
                    className="postit-hover-btn postit-hover-btn--delete"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(note.id) }}
                    title="Delete note"
                    aria-label="Delete note"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                <div className="postit-body">
                  <h3 className="postit-title">{displayTitle}</h3>
                  <div className="postit-divider" />

                  <p className="postit-preview">{note.content || 'Empty note…'}</p>

                  {note.tags.length > 0 && (
                    <div className="postit-tags">
                      {note.tags.slice(0, 2).map(t => (
                        <span key={t} className="postit-tag">#{t}</span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="postit-tag postit-tag--more">+{note.tags.length - 2}</span>
                      )}
                    </div>
                  )}

                  <span className="postit-date">{formatDate(note.updated_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating toolbar (top-right) */}
      <div className="canvas-float-toolbar">
        <div className="canvas-float-search-wrap">
          <Search size={14} className="canvas-float-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="canvas-float-search"
            placeholder="Search notes…"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            aria-label="Search notes"
          />
        </div>
        <button
          id="new-note-btn"
          className="canvas-float-new-btn"
          onClick={handleNewNote}
          aria-label="Create new note"
        >
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
          New Note
        </button>
      </div>

      {/* Floating note count (top-left) */}
      <div className="canvas-float-count">
        📌 {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </div>

      {/* Floating zoom controls (bottom-left) */}
      <div className="canvas-float-zoom">
        <button className="canvas-zoom-btn" onClick={handleZoomOut} aria-label="Zoom out" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button className="canvas-zoom-label" onClick={handleResetView} title="Reset view">
          {zoomPercent}%
        </button>
        <button className="canvas-zoom-btn" onClick={handleZoomIn} aria-label="Zoom in" title="Zoom in">
          <ZoomIn size={14} />
        </button>
      </div>

      {/* ── Note Click / Editor Modal ── */}
      {editingId && (
        <div className="note-modal-overlay" onClick={closeEditor} role="dialog" aria-modal="true" aria-label="Note editor">
          <div
            className="note-modal-paper"
            style={{
              background: NOTE_PALETTE.find(p => p.bg === draftColor)?.gradient || draftColor
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 3D Pushpin on top center */}
            <PushPinSVG />

            {/* Close cross button top right */}
            <button className="note-modal-paper-close" onClick={closeEditor} aria-label="Close note" title="Close note">
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* Title Section with Max Length */}
            <div className="note-modal-paper-header">
              <input
                type="text"
                className="note-modal-paper-title-input"
                placeholder="Title…"
                maxLength={MAX_TITLE_LENGTH}
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
              />
            </div>

            {/* Horizontal Divider Line under Title */}
            <div className="note-modal-paper-divider" />

            {/* Notebook Ruled Body with scroll & left red margin line */}
            <div className="note-modal-paper-body">
              <div className="note-modal-paper-margin-line" />
              <textarea
                ref={textareaRef}
                className="note-modal-paper-content"
                placeholder="Write your note here…"
                maxLength={MAX_CONTENT_LENGTH}
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                autoFocus
              />
            </div>

            {/* Tag Editor Row */}
            <div className="note-modal-paper-tags-row">
              <Tag size={11} className="note-modal-tag-icon" aria-hidden="true" />
              {tags.map(t => (
                <span key={t} className="note-modal-paper-tag">
                  #{t}
                  <button onClick={() => removeTag(t)} className="note-modal-tag-remove" aria-label={`Remove tag ${t}`}><X size={9} /></button>
                </span>
              ))}
              <input
                type="text"
                className="note-modal-tag-input"
                placeholder="Add tag…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                onBlur={() => addTag(tagInput)}
              />
            </div>

            {/* Footer with Character Limit Counter */}
            <div className="note-modal-paper-footer">
              {/* Color swatches */}
              <div className="note-modal-colors">
                {NOTE_PALETTE.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`note-color-dot ${draftColor === p.bg ? 'note-color-dot--active' : ''}`}
                    style={{ background: p.gradient || p.bg }}
                    onClick={() => {
                      setDraftColor(p.bg)
                      if (editingId) {
                        onNotesChange(prev => prev.map(n => n.id === editingId ? { ...n, color: p.bg } : n))
                      }
                    }}
                    title={`Color: ${p.label}`}
                    aria-label={`Select ${p.label} color`}
                  />
                ))}
              </div>

              {/* Timestamp, Character Limit & Actions */}
              <div className="note-modal-footer-right">
                <span className={`note-modal-char-count ${isNearLimit ? 'note-modal-char-count--limit' : ''}`}>
                  {draftContent.length}/{MAX_CONTENT_LENGTH}
                </span>
                <span className="note-modal-paper-date">
                  {formatDate(currentNote?.updated_at || new Date().toISOString())}
                </span>
                <button
                  className="note-modal-paper-delete-btn"
                  onClick={() => setDeleteTarget(editingId)}
                  aria-label="Delete note"
                  title="Delete note"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
                <button
                  className={`note-modal-paper-save-btn${isSaving ? ' note-modal-paper-save-btn--saving' : ''}`}
                  onClick={handleSave}
                  disabled={isSaving}
                  aria-label="Save note"
                  title="Save note"
                >
                  <Save size={13} strokeWidth={2} />
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="note-delete-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="note-delete-dialog" onClick={e => e.stopPropagation()}>
            <h2 className="note-delete-title">Delete note?</h2>
            <p className="note-delete-desc">This can't be undone.</p>
            <div className="note-delete-actions">
              <button onClick={() => setDeleteTarget(null)} className="note-delete-cancel">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="note-delete-confirm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
