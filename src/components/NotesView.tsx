import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Tag, X, Search, ZoomIn, ZoomOut } from 'lucide-react'
import type { NoteRecord } from '../types'
import { generateId } from '../lib/helpers'
import { createNoteApi, updateNoteApi, deleteNoteApi } from '../lib/notes-api'
import { recordDeletedId, removeDeletedId } from '../lib/storage'

interface NotesViewProps {
  notes: NoteRecord[]
  onNotesChange: (updater: (prev: NoteRecord[]) => NoteRecord[]) => void
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function deriveTitle(content: string): string {
  return content.split('\n').find(l => l.trim())?.slice(0, 60) ?? 'Untitled'
}

// Post-it color palette
const NOTE_COLORS = [
  { bg: 'var(--postit-yellow)', pin: '#e63946' },
  { bg: 'var(--postit-pink)', pin: '#2a9d8f' },
  { bg: 'var(--postit-blue)', pin: '#e76f51' },
  { bg: 'var(--postit-green)', pin: '#9b5de5' },
  { bg: 'var(--postit-orange)', pin: '#264653' },
]

function noteStyle(id: string, idx: number) {
  const colorIdx = idx % NOTE_COLORS.length
  const charCode = id.charCodeAt(id.length - 1) % 5
  const rotation = [-2.5, -1.2, 0, 1.2, 2.5][charCode]
  return { color: NOTE_COLORS[colorIdx], rotation }
}

const CARD_W = 180
const CARD_H = 180
const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

export function NotesView({ notes, onNotesChange }: NotesViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [draftContent])

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
        // Regular scroll → pan
        setPanX(prev => prev - e.deltaX)
        setPanY(prev => prev - e.deltaY)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Canvas pan (drag on empty space) ───────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent) {
    // Only if clicking on the canvas itself, not on a note
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

    // Note dragging
    if (dragRef.current) {
      e.preventDefault()
      const dx = (e.clientX - dragRef.current.startX) / zoom
      const dy = (e.clientY - dragRef.current.startY) / zoom
      const newX = dragRef.current.origX + dx
      const newY = dragRef.current.origY + dy

      onNotesChange(prev => prev.map(n =>
        n.id === dragRef.current!.noteId ? { ...n, x: newX, y: newY } : n
      ))
    }
  }

  function handleCanvasPointerUp(e: React.PointerEvent) {
    if (panRef.current) {
      panRef.current = null
      return
    }

    if (dragRef.current) {
      const dx = Math.abs(e.clientX - dragRef.current.startX)
      const dy = Math.abs(e.clientY - dragRef.current.startY)
      if (dx < 5 && dy < 5) {
        const note = notes.find(n => n.id === dragRef.current!.noteId)
        if (note) openNote(note)
      }
      dragRef.current = null
    }
  }

  // ── Note drag ──────────────────────────────────────────────────
  function handleNotePointerDown(e: React.PointerEvent, note: NoteRecord) {
    if (e.button !== 0) return
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

  // ── Note CRUD ─────────────────────────────────────────────────
  function openNote(note: NoteRecord) {
    setEditingId(note.id)
    setDraftContent(note.content)
    setDraftTitle(note.title)
    setDraftTags(note.tags.join(', '))
    setTagInput('')
  }

  function closeEditor() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (editingId) flushSave(editingId)
    setEditingId(null)
  }

  const scheduleSave = useCallback((id: string, content: string, title: string, tags: string[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(id, content, title, tags), 1000)
  }, [])

  async function doSave(id: string, content: string, title: string, tags: string[]) {
    const isNew = notes.find(n => n.id === id)?.isNew
    const now = new Date().toISOString()
    const resolvedTitle = title.trim() || deriveTitle(content)
    const resolvedTags = tags

    onNotesChange(prev => prev.map(n =>
      n.id === id ? { ...n, content, title: resolvedTitle, tags: resolvedTags, updated_at: now, isNew: false } : n
    ))

    if (isNew) {
      const remote = await createNoteApi({ content, title: resolvedTitle, tags: resolvedTags })
      if (remote) {
        onNotesChange(prev => prev.map(n => n.id === id ? { ...remote, x: n.x, y: n.y, isNew: false } : n))
      }
    } else {
      await updateNoteApi(id, { content, title: resolvedTitle, tags: resolvedTags })
    }
  }

  function flushSave(id: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    doSave(id, draftContent, draftTitle.trim() || deriveTitle(draftContent), parseTags(draftTags))
  }

  function parseTags(raw: string): string[] {
    return raw.split(',').map(t => t.trim()).filter(Boolean)
  }

  function handleContentChange(val: string) {
    setDraftContent(val)
    if (!editingId) return
    scheduleSave(editingId, val, draftTitle, parseTags(draftTags))
  }

  function handleTitleChange(val: string) {
    setDraftTitle(val)
    if (!editingId) return
    scheduleSave(editingId, draftContent, val, parseTags(draftTags))
  }

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    const existing = parseTags(draftTags)
    if (existing.includes(tag)) return
    const next = [...existing, tag].join(', ')
    setDraftTags(next)
    setTagInput('')
    if (editingId) scheduleSave(editingId, draftContent, draftTitle, parseTags(next))
  }

  function removeTag(tag: string) {
    const next = parseTags(draftTags).filter(t => t !== tag).join(', ')
    setDraftTags(next)
    if (editingId) scheduleSave(editingId, draftContent, draftTitle, parseTags(next))
  }

  function handleNewNote() {
    const tempId = generateId()
    const now = new Date().toISOString()

    // Place near center of current viewport
    const centerX = (-panX + (canvasRef.current?.clientWidth ?? 800) / 2) / zoom
    const centerY = (-panY + (canvasRef.current?.clientHeight ?? 600) / 2) / zoom
    const jitterX = (Math.random() - 0.5) * 100
    const jitterY = (Math.random() - 0.5) * 100

    const newNote: NoteRecord = {
      id: tempId,
      title: '',
      content: '',
      tags: [],
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
      // Pan to the found note
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

  return (
    <div className="excalidraw-canvas-wrap">
      {/* The infinite canvas */}
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
              <div style={{ fontSize: '3rem', opacity: 0.15 }}>📌</div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-dim)', opacity: 0.4 }}>Click "+ New Note" to pin a thought</p>
            </div>
          )}

          {notes.map((note, idx) => {
            const { color, rotation } = noteStyle(note.id, idx)
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
                  '--postit-color': color.bg,
                  '--postit-rotation': `${rotation}deg`,
                } as React.CSSProperties}
                onPointerDown={e => handleNotePointerDown(e, note)}
                role="button"
                tabIndex={0}
                aria-label={`Note: ${displayTitle}. Drag to move.`}
              >
                {/* Push-pin */}
                <div className="postit-pin" style={{ color: color.pin }}>
                  <svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="9" cy="7" rx="7" ry="7" fill="currentColor" />
                    <ellipse cx="9" cy="7" rx="4" ry="4" fill="rgba(255,255,255,0.3)" />
                    <rect x="8" y="12" width="2" height="12" rx="1" fill="currentColor" opacity="0.5" />
                  </svg>
                </div>

                <div className="postit-body">
                  <p className="postit-title">{displayTitle}</p>
                  <p className="postit-preview">{note.content || 'Empty note…'}</p>
                  {note.tags.length > 0 && (
                    <div className="postit-tags">
                      {note.tags.slice(0, 2).map(t => (
                        <span key={t} className="postit-tag">{t}</span>
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

      {/* ── Floating toolbar (overlays canvas top-right) ────── */}
      <div className="canvas-float-toolbar">
        <div className="canvas-float-search-wrap">
          <Search size={12} className="canvas-float-search-icon" aria-hidden="true" />
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
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          New Note
        </button>
      </div>

      {/* ── Floating note count (top-left) ────── */}
      <div className="canvas-float-count">
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </div>

      {/* ── Floating zoom controls (bottom-left, like Excalidraw) ────── */}
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

      {/* Note editor modal */}
      {editingId && (
        <div className="note-modal-overlay" onClick={closeEditor} role="dialog" aria-modal="true" aria-label="Note editor">
          <div className="note-modal" onClick={e => e.stopPropagation()}>
            <div className="note-modal-toolbar">
              <span className="note-modal-autosave">Auto-saving…</span>
              <div className="note-modal-toolbar-actions">
                <button className="note-modal-delete-btn" onClick={() => setDeleteTarget(editingId)} aria-label="Delete note" title="Delete note">
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
                <button className="note-modal-close-btn" onClick={closeEditor} aria-label="Close editor" title="Close">
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
            <input type="text" className="note-modal-title-input" placeholder="Title (optional)" value={draftTitle} onChange={e => handleTitleChange(e.target.value)} />
            <div className="note-modal-tags-row">
              <Tag size={11} className="note-modal-tag-icon" aria-hidden="true" />
              {tags.map(t => (
                <span key={t} className="note-modal-tag">
                  {t}
                  <button onClick={() => removeTag(t)} className="note-modal-tag-remove" aria-label={`Remove tag ${t}`}><X size={9} /></button>
                </span>
              ))}
              <input type="text" className="note-modal-tag-input" placeholder="Add tag…" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                onBlur={() => addTag(tagInput)} />
            </div>
            <textarea ref={textareaRef} className="note-modal-content" placeholder="Start writing…" value={draftContent} onChange={e => handleContentChange(e.target.value)} autoFocus />
            <div className="note-modal-footer">
              <span className="note-modal-footer-date">{currentNote ? `Edited ${formatDate(currentNote.updated_at)}` : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
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
