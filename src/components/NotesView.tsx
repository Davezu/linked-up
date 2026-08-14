import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Tag, X, Search, ZoomIn, ZoomOut, Save, Edit3, FolderOpen, FolderPlus, ChevronDown } from 'lucide-react'
import type { NoteRecord, FolderRecord } from '../types'
import { generateId } from '../lib/helpers'
import { createNoteApi, updateNoteApi, deleteNoteApi } from '../lib/notes-api'
import { recordDeletedId, removeDeletedId, loadFolders, saveFolders } from '../lib/storage'
import { animateNoteDrop } from './react-bits/animations'
import { Folder as ReactBitsFolder } from './react-bits/Folder'

import { Folder as FolderIcon } from 'lucide-react'

interface NotesViewProps {
  notes: NoteRecord[]
  onNotesChange: (updater: (prev: NoteRecord[]) => NoteRecord[]) => void
  activeFolder?: string | null
  onSelectFolder?: (folder: string | null) => void
}

export const MAX_CONTENT_LENGTH = 1000
export const MAX_TITLE_LENGTH = 80
export const NOTE_LINE_HEIGHT = 28
export const NOTE_MIN_LINES = 8

export const NOTE_PALETTE = [
  { id: 'yellow', bg: '#fff59d', gradient: 'linear-gradient(175deg, #fff9c4 0%, #fff176 100%)', label: 'Canary Yellow' },
  { id: 'cyan', bg: '#e0f2fe', gradient: 'linear-gradient(175deg, #f0f9ff 0%, #bae6fd 100%)', label: 'Sky Blue' },
  { id: 'green', bg: '#dcfce7', gradient: 'linear-gradient(175deg, #f0fdf4 0%, #bbf7d0 100%)', label: 'Mint Green' },
  { id: 'pink', bg: '#fde8f4', gradient: 'linear-gradient(175deg, #fff1f2 0%, #fbcfe8 100%)', label: 'Pastel Pink' },
  { id: 'lavender', bg: '#f3e8ff', gradient: 'linear-gradient(175deg, #faf5ff 0%, #e9d5ff 100%)', label: 'Lavender' },
  { id: 'peach', bg: '#ffedd5', gradient: 'linear-gradient(175deg, #fff7ed 0%, #fed7aa 100%)', label: 'Warm Peach' },
]

export const DEFAULT_FOLDERS = ['Personal', 'Work', 'Ideas', 'Project']

// Folder colors for visual variety
const FOLDER_COLORS = ['#5227FF', '#e85d04', '#2d6a4f', '#9b2226', '#0077b6', '#7b2d8b']
function pickFolderColor(id: string) {
  const idx = id.charCodeAt(id.length - 1) % FOLDER_COLORS.length
  return FOLDER_COLORS[idx]
}

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

function deriveTitle(content?: string): string {
  if (!content || typeof content !== 'string') return 'Untitled'
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

// Default folder canvas size (matches React Bits Folder visual)
const FOLDER_W = 72
const FOLDER_H = 90 // back + label area

type CanvasTool = 'select' | 'folder'

export function NotesView({ notes, onNotesChange, activeFolder, onSelectFolder }: NotesViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftColor, setDraftColor] = useState<string>(NOTE_PALETTE[0].bg)
  const [draftFolder, setDraftFolder] = useState<string>('Personal')
  const [tagInput, setTagInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [dropAnimId, setDropAnimId] = useState<string | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Canvas pan & zoom state
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)

  // ── Folder tool state ────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [folders, setFolders] = useState<FolderRecord[]>(() => loadFolders())
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null)
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const hoveredFolderIdRef = useRef<string | null>(null)
  const [addNoteDropdown, setAddNoteDropdown] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const safeNotes = Array.isArray(notes) ? notes.filter(n => n && n.id) : []
  const safeFolders = Array.isArray(folders) ? folders.filter(f => f && f.id) : []

  // Set of all note IDs that are contained inside any canvas folder
  const allCanvasFolderNoteIds = new Set(
    safeFolders.flatMap(f => Array.isArray(f.noteIds) ? f.noteIds : [])
  )

  // Notes displayed on the main canvas board:
  // If activeFolder (from top nav filter) is set, filter by that.
  // Otherwise, display notes that are NOT inside a canvas folder!
  const canvasDisplayNotes = activeFolder
    ? safeNotes.filter(n => n.folder === activeFolder)
    : safeNotes.filter(n => !allCanvasFolderNoteIds.has(n.id))
  const folderDragRef = useRef<{
    folderId: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  // Persist folders whenever they change
  useEffect(() => { saveFolders(folders) }, [folders])

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

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lines = Math.max(NOTE_MIN_LINES, Math.ceil(el.scrollHeight / NOTE_LINE_HEIGHT))
    el.style.height = `${lines * NOTE_LINE_HEIGHT}px`
  }, [])

  useLayoutEffect(() => {
    if (!editingId) return
    syncTextareaHeight()
  }, [editingId, draftContent, syncTextareaHeight])

  // Close modal on Escape
  useEffect(() => {
    if (!editingId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingId])

  // Close folder popover on Escape
  useEffect(() => {
    if (!openFolderId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenFolderId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openFolderId])

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingFolderId && renameInputRef.current) {
      renameInputRef.current.select()
    }
  }, [renamingFolderId])

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

  // ── Canvas click — folder placement ───────────────────────────
  function handleCanvasClick(e: React.MouseEvent) {
    if (activeTool !== 'folder') return
    // Ignore if clicking on an existing object
    if ((e.target as HTMLElement).closest('.postit-note') || (e.target as HTMLElement).closest('.canvas-folder-item')) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()

    // Convert screen coords → canvas coords
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const canvasX = (screenX - panX) / zoom
    const canvasY = (screenY - panY) / zoom

    const newFolder: FolderRecord = {
      id: generateId(),
      type: 'folder',
      x: canvasX - FOLDER_W / 2,
      y: canvasY - FOLDER_H / 2,
      width: FOLDER_W,
      height: FOLDER_H,
      name: 'New Folder',
      noteIds: [],
    }

    setFolders(prev => [...prev, newFolder])
    setSelectedFolderId(newFolder.id)
    setActiveTool('select') // Switch back to select tool
  }

  // ── Canvas pan (drag on empty space) ───────────────────────────
  function handleCanvasPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('.postit-note')) return
    if ((e.target as HTMLElement).closest('.canvas-folder-item')) return
    if (activeTool === 'folder') return // folder placement handled by onClick
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
      const pointerDx = e.clientX - startX
      const pointerDy = e.clientY - startY

      if (Math.hypot(pointerDx, pointerDy) > 5) {
        setDraggingNoteId(noteId)
      }

      const newX = origX + dx
      const newY = origY + dy

      onNotesChange(prev => prev.map(n =>
        n.id === noteId ? { ...n, x: newX, y: newY } : n
      ))

      // ── Detect folder drop target using mouse cursor & note bounds in canvas coordinates ──
      const canvasEl = canvasRef.current
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect()
        const mouseCanvasX = (e.clientX - rect.left - panX) / zoom
        const mouseCanvasY = (e.clientY - rect.top - panY) / zoom

        const noteCenterX = newX + CARD_W / 2
        const noteCenterY = newY + CARD_H / 2

        const HIT_PAD = 35
        const hit = folders.find(f => {
          if (f.noteIds.includes(noteId)) return false
          const mouseHit = (
            mouseCanvasX >= f.x - HIT_PAD &&
            mouseCanvasX <= f.x + f.width + HIT_PAD &&
            mouseCanvasY >= f.y - HIT_PAD &&
            mouseCanvasY <= f.y + f.height + HIT_PAD
          )
          const centerHit = (
            noteCenterX >= f.x - HIT_PAD &&
            noteCenterX <= f.x + f.width + HIT_PAD &&
            noteCenterY >= f.y - HIT_PAD &&
            noteCenterY <= f.y + f.height + HIT_PAD
          )
          return mouseHit || centerHit
        })

        const targetId = hit?.id ?? null
        hoveredFolderIdRef.current = targetId
        setHoveredFolderId(targetId)
      }
    }

    if (folderDragRef.current) {
      e.preventDefault()
      const { folderId, startX, startY, origX, origY } = folderDragRef.current
      const dx = (e.clientX - startX) / zoom
      const dy = (e.clientY - startY) / zoom
      const pointerDx = e.clientX - startX
      const pointerDy = e.clientY - startY

      if (Math.hypot(pointerDx, pointerDy) > 5) {
        setDraggingFolderId(folderId)
      }

      setFolders(prev => prev.map(f =>
        f.id === folderId ? { ...f, x: origX + dx, y: origY + dy } : f
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
      setDraggingNoteId(null)

      const targetFolderId = hoveredFolderIdRef.current || hoveredFolderId
      hoveredFolderIdRef.current = null
      setHoveredFolderId(null)

      // Drop into hovered folder
      if (targetFolderId) {
        addNoteToFolder(targetFolderId, noteId)
        return // don't open the note editor on a drop
      }

      const dx = Math.abs(e.clientX - startX)
      const dy = Math.abs(e.clientY - startY)
      if (dx < 5 && dy < 5) {
        const note = notes.find(n => n.id === noteId)
        if (note) openNote(note)
      }
    }

    if (folderDragRef.current) {
      const { startX, startY } = folderDragRef.current
      folderDragRef.current = null
      setDraggingFolderId(null)
      const dx = Math.abs(e.clientX - startX)
      const dy = Math.abs(e.clientY - startY)
      // Small movement = click → open popover
      if (dx < 5 && dy < 5) {
        // handled by folder item's own onClick
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
    setDraggingNoteId(null)
  }

  // Folder drag
  function handleFolderPointerDown(e: React.PointerEvent, folder: FolderRecord) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.folder-popover')) return
    if ((e.target as HTMLElement).closest('.paper') && openFolderId === folder.id) return
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)

    folderDragRef.current = {
      folderId: folder.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: folder.x,
      origY: folder.y,
    }
    setDraggingFolderId(null)
    setSelectedFolderId(folder.id)
  }

  function handleFolderClick(e: React.MouseEvent, folder: FolderRecord) {
    if ((e.target as HTMLElement).closest('.paper') && openFolderId === folder.id) return
    e.stopPropagation()
    setSelectedFolderId(folder.id)
    setOpenFolderId(prev => prev === folder.id ? null : folder.id)
    setAddNoteDropdown(false)
  }

  function handleFolderDoubleClick(e: React.MouseEvent, folder: FolderRecord) {
    e.stopPropagation()
    setOpenFolderId(prev => prev === folder.id ? null : folder.id)
    setAddNoteDropdown(false)
  }

  // ── Folder CRUD ───────────────────────────────────────────────
  function startRename(folder: FolderRecord) {
    setRenamingFolderId(folder.id)
    setRenameValue(folder.name)
  }

  function commitRename(folderId: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingFolderId(null); return }
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: trimmed } : f))
    setRenamingFolderId(null)
  }

  function deleteFolder(folderId: string) {
    setFolders(prev => prev.filter(f => f.id !== folderId))
    if (selectedFolderId === folderId) setSelectedFolderId(null)
    if (openFolderId === folderId) setOpenFolderId(null)
  }

  function setFolderColor(folderId: string, color: string) {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, color } : f))
  }

  function addNoteToFolder(folderId: string, noteId: string) {
    const targetFolder = folders.find(f => f.id === folderId)
    if (!targetFolder) return

    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return f.noteIds.includes(noteId) ? f : { ...f, noteIds: [...f.noteIds, noteId] }
      }
      return { ...f, noteIds: f.noteIds.filter(id => id !== noteId) }
    }))

    // Also sync note.folder field
    onNotesChange(prev => prev.map(n =>
      n.id === noteId ? { ...n, folder: targetFolder.name } : n
    ))
  }

  function removeNoteFromFolder(folderId: string, noteId: string) {
    const folder = folders.find(f => f.id === folderId)
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, noteIds: f.noteIds.filter(id => id !== noteId) } : f
    ))

    // Place note back onto canvas near the folder
    onNotesChange(prev => prev.map(n => {
      if (n.id !== noteId) return n
      const newX = folder ? folder.x + 110 : (n.x ?? 100)
      const newY = folder ? folder.y + 10 : (n.y ?? 100)
      return { ...n, folder: undefined, x: newX, y: newY }
    }))
  }

  function createNoteInFolder(folderId: string) {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

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
      folder: folder.name,
    }
    onNotesChange(prev => [newNote, ...prev])
    setFolders(prev => prev.map(f =>
      f.id === folderId ? { ...f, noteIds: [...f.noteIds, tempId] } : f
    ))
    openNote(newNote)
    setDropAnimId(tempId)
    window.setTimeout(() => setDropAnimId(null), 900)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Note CRUD
  function openNote(note: NoteRecord) {
    setEditingId(note.id)
    setDraftContent(note.content)
    setDraftTitle(note.title)
    setDraftTags(note.tags.join(', '))
    setDraftColor(note.color || NOTE_PALETTE[0].bg)
    setDraftFolder(note.folder || activeFolder || 'Personal')
    setTagInput('')
    setSaveError(null)
  }

  function closeEditor() {
    if (editingId) {
      const note = notes.find(n => n.id === editingId)
      if (note?.isNew) {
        onNotesChange(prev => prev.filter(n => n.id !== editingId))
        // Also remove from any folder
        setFolders(prev => prev.map(f => ({
          ...f,
          noteIds: f.noteIds.filter(id => id !== editingId)
        })))
      }
    }
    setEditingId(null)
    setIsSaving(false)
    setSaveError(null)
  }

  async function handleSave() {
    if (!editingId || isSaving) return
    if (!draftContent.trim()) {
      setSaveError('Add some note content before saving.')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    const id = editingId
    const isNew = notes.find(n => n.id === id)?.isNew
    const now = new Date().toISOString()
    const resolvedTitle = draftTitle.trim() || deriveTitle(draftContent)
    const resolvedTags = parseTags(draftTags)

    if (isNew) {
      const result = await createNoteApi({ content: draftContent, title: resolvedTitle, tags: resolvedTags })
      if (result.ok === false) {
        setSaveError(result.error)
        setIsSaving(false)
        return
      }

      onNotesChange(prev => prev.map(n =>
        n.id === id
          ? { ...result.data, x: n.x, y: n.y, color: draftColor, folder: draftFolder, isNew: false }
          : n
      ))
      // If the temp ID changed to a server ID, update folder noteIds
      if (result.data && result.data.id && result.data.id !== id) {
        setFolders(prev => prev.map(f => ({
          ...f,
          noteIds: f.noteIds.map(nid => nid === id ? result.data.id : nid)
        })))
      }
    } else {
      onNotesChange(prev => prev.map(n =>
        n.id === id
          ? {
            ...n,
            content: draftContent,
            title: resolvedTitle,
            tags: resolvedTags,
            color: draftColor,
            folder: draftFolder,
            updated_at: now,
          }
          : n
      ))

      const result = await updateNoteApi(id, { content: draftContent, title: resolvedTitle, tags: resolvedTags })
      if (result.ok === false) {
        setSaveError(result.error)
        setIsSaving(false)
        return
      }
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
    setDropAnimId(tempId)
    window.setTimeout(() => setDropAnimId(null), 900)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  async function handleDelete(id: string) {
    setDeleteTarget(null)
    if (editingId === id) setEditingId(null)
    recordDeletedId(id)
    onNotesChange(prev => prev.filter(n => n.id !== id))
    // Remove from any canvas folder
    setFolders(prev => prev.map(f => ({
      ...f,
      noteIds: f.noteIds.filter(nid => nid !== id)
    })))
    const result = await deleteNoteApi(id)
    if (result.ok) removeDeletedId(id)
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

  // Compute which folder is currently open
  const openFolder = openFolderId ? folders.find(f => f.id === openFolderId) ?? null : null
  // Notes inside the open folder
  const openFolderNotes = openFolder
    ? openFolder.noteIds.map(id => notes.find(n => n.id === id)).filter(Boolean) as NoteRecord[]
    : []
  // Notes that can be added to the open folder
  const notesNotInFolder = openFolder
    ? notes.filter(n => !openFolder.noteIds.includes(n.id) && !n.isNew)
    : []

  return (
    <div className="excalidraw-canvas-wrap">
      {/* The canvas */}
      <div
        ref={canvasRef}
        className={`excalidraw-canvas${activeTool === 'folder' ? ' excalidraw-canvas--folder-mode' : ''}`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onClick={handleCanvasClick}
      >
        <div
          className="excalidraw-canvas-inner"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* ── Canvas Folder Items ── */}
          {folders.map(folder => {
            const isSelected = selectedFolderId === folder.id
            const isOpen = openFolderId === folder.id
            const isDragging = draggingFolderId === folder.id
            const isDropTarget = hoveredFolderId === folder.id
            const folderColor = folder.color || pickFolderColor(folder.id)
            const fNoteIds = Array.isArray(folder.noteIds) ? folder.noteIds : []
            const noteCount = fNoteIds.length

            const fNotes = fNoteIds.map(id => safeNotes.find(n => n.id === id)).filter(Boolean) as NoteRecord[]
            const folderPreviewItems = fNotes.slice(0, 3).map(n => (
              <div key={n.id} style={{ fontSize: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center', fontWeight: 700, color: '#333' }}>
                📝 {n.title || deriveTitle(n.content) || 'Note'}
              </div>
            ))

            return (
              <div
                key={folder.id}
                className={`canvas-folder-item${isSelected ? ' canvas-folder-item--selected' : ''}${isDragging ? ' canvas-folder-item--dragging' : ''}${isDropTarget ? ' canvas-folder-item--drop-target' : ''}`}
                style={{
                  left: folder.x,
                  top: folder.y,
                  width: folder.width,
                }}
                onPointerDown={e => handleFolderPointerDown(e, folder)}
                onClick={e => handleFolderClick(e, folder)}
                onDoubleClick={e => handleFolderDoubleClick(e, folder)}
                role="button"
                tabIndex={0}
                aria-label={`Folder: ${folder.name}. Double-click to open.`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') handleFolderDoubleClick(e as any, folder)
                  if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (isSelected) deleteFolder(folder.id)
                  }
                }}
              >
                <ReactBitsFolder
                  color={folderColor}
                  size={1}
                  name={folder.name}
                  count={noteCount > 0 ? noteCount : undefined}
                  items={folderPreviewItems}
                  isOpen={isOpen}
                  onOpenChange={open => setOpenFolderId(open ? folder.id : null)}
                  onItemClick={index => {
                    const targetNote = fNotes[index]
                    if (targetNote) openNote(targetNote)
                  }}
                />

                {/* Folder name label below */}
                {renamingFolderId === folder.id ? (
                  <input
                    ref={renameInputRef}
                    className="canvas-folder-rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(folder.id)}
                    onKeyDown={e => {
                      e.stopPropagation()
                      if (e.key === 'Enter') commitRename(folder.id)
                      if (e.key === 'Escape') setRenamingFolderId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    maxLength={40}
                  />
                ) : (
                  <div
                    className="canvas-folder-label"
                    onDoubleClick={e => { e.stopPropagation(); startRename(folder) }}
                    title="Double-click to rename"
                  >
                    {folder.name}
                  </div>
                )}

                {/* Speech bubble / Cloud callout action toolbar (Edit | Colors | Delete) */}
                {isOpen && (
                  <div
                    className="folder-cloud-callout"
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <div className="folder-cloud-tail" />
                    <button
                      className="folder-cloud-btn"
                      onClick={e => { e.stopPropagation(); startRename(folder) }}
                      title="Rename folder"
                      aria-label="Rename folder"
                    >
                      <Edit3 size={13} />
                      <span>edit</span>
                    </button>

                    <div className="folder-cloud-colors">
                      {FOLDER_COLORS.map(c => (
                        <button
                          key={c}
                          className={`folder-color-dot${folderColor === c ? ' folder-color-dot--active' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={e => { e.stopPropagation(); setFolderColor(folder.id, c) }}
                          title="Change folder color"
                        />
                      ))}
                    </div>

                    <button
                      className="folder-cloud-btn folder-cloud-btn--delete"
                      onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }}
                      title="Delete folder"
                      aria-label="Delete folder"
                    >
                      <Trash2 size={13} />
                      <span>delete</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Canvas Notes ── */}
          {canvasDisplayNotes.map((note, idx) => {
            const noteColorObj = NOTE_PALETTE.find(p => p.bg === note.color) || NOTE_PALETTE[idx % NOTE_PALETTE.length]
            const noteColor = noteColorObj.bg
            const noteGradient = noteColorObj.gradient
            const rotation = noteRotation(note.id)
            const displayTitle = note.title || deriveTitle(note.content) || 'Untitled'
            const isHighlighted = highlightId === note.id
            const posX = note.x ?? 100 + (idx % 4) * (CARD_W + 24)
            const posY = note.y ?? 100 + Math.floor(idx / 4) * (CARD_H + 24)

            const bg = noteGradient || noteColor
            const isDragging = draggingNoteId === note.id

            return (
              <div
                key={note.id}
                ref={el => {
                  if (el && note.id === dropAnimId) animateNoteDrop(el)
                }}
                className={`postit-note${isDragging ? ' postit-note--dragging' : ''}${isHighlighted ? ' postit-note--highlight' : ''}`}
                style={{
                  left: posX,
                  top: posY,
                  width: CARD_W,
                  height: CARD_H,
                  minHeight: CARD_H,
                  background: bg,
                  transform: `rotate(${rotation}deg)`,
                  ['--note-rot' as string]: `${rotation}deg`,
                }}
                onPointerDown={e => handleNotePointerDown(e, note)}
                role="button"
                tabIndex={0}
                aria-label={`Note: ${displayTitle}. Drag to move.`}
              >
                <PushPinSVG />

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

        {/* Folder tool button */}
        <button
          id="folder-tool-btn"
          className={`canvas-folder-tool-btn${activeTool === 'folder' ? ' canvas-folder-tool-btn--active' : ''}`}
          onClick={() => setActiveTool(prev => prev === 'folder' ? 'select' : 'folder')}
          title={activeTool === 'folder' ? 'Cancel folder placement (click canvas to place)' : 'Add folder to canvas'}
          aria-label="Folder tool"
          aria-pressed={activeTool === 'folder'}
        >
          <FolderPlus size={15} strokeWidth={2.2} aria-hidden="true" />
          {activeTool === 'folder' ? 'Click to place…' : 'Add Folder'}
        </button>

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

      {/* Floating note count & active folder filter (top-left) */}
      <div className="canvas-float-count flex items-center gap-2">
        <span>📌 {canvasDisplayNotes.length} {canvasDisplayNotes.length === 1 ? 'note' : 'notes'}</span>
        {folders.length > 0 && (
          <span className="canvas-folder-count">
            🗂️ {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
          </span>
        )}
        {activeFolder && (
          <span className="flex items-center gap-1 bg-[#5227FF] text-white px-2 py-0.5 rounded-full text-xs font-semibold">
            <FolderIcon size={11} /> {activeFolder}
            <button onClick={() => onSelectFolder?.(null)} className="ml-1 hover:text-amber-300">✕</button>
          </span>
        )}
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

      {/* Folder tool hint banner */}
      {activeTool === 'folder' && (
        <div className="canvas-folder-hint" role="status">
          <FolderPlus size={14} aria-hidden="true" />
          Click anywhere on the canvas to place a folder
          <button
            className="canvas-folder-hint-cancel"
            onClick={() => setActiveTool('select')}
          >
            Cancel
          </button>
        </div>
      )}

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

            {/* Title & Folder Row */}
            <div className="note-modal-paper-header flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  className="note-modal-paper-title-input flex-1"
                  placeholder="Title…"
                  maxLength={MAX_TITLE_LENGTH}
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  spellCheck={false}
                />
                <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 px-2 py-1 rounded-lg text-xs font-semibold">
                  <FolderIcon size={12} className="text-[#5227FF]" />
                  <select
                    value={draftFolder}
                    onChange={e => setDraftFolder(e.target.value)}
                    className="bg-transparent border-none text-xs outline-none cursor-pointer font-bold text-[var(--text-main)]"
                  >
                    {DEFAULT_FOLDERS.map(f => (
                      <option key={f} value={f} className="bg-[var(--bg-card)] text-[var(--text-main)]">{f}</option>
                    ))}
                  </select>
                </div>
              </div>
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
                spellCheck={false}
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

            {saveError && (
              <p className="note-modal-save-error" role="alert">{saveError}</p>
            )}

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
