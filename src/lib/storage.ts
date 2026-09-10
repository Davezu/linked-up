import type { LinkRecord, NoteRecord, FolderRecord } from '../types'
import { STORAGE_KEY, NOTES_STORAGE_KEY, FOLDERS_STORAGE_KEY, LEGACY_CATEGORY_MAP } from './constants'

export function normalizeCategory(category: string): string {
  const mapped = LEGACY_CATEGORY_MAP[category] ?? category
  const lower = mapped.toLowerCase()
  if (lower.includes('dog') || lower.includes('cat') || lower.includes('animal') || lower.includes('pet')) {
    return '🐾 Pets'
  }
  return mapped
}

export const DELETED_IDS_KEY = 'link-organizer-deleted-ids'
const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/* Safe localStorage.setItem - swallows QuotaExceededError gracefully */
function trySet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[storage] localStorage quota exceeded — tombstone not saved:', key)
    } else {
      throw e
    }
  }
}

/* Tombstones stored as { [id]: timestamp } — entries expire after 7 days */
function readTombstoneMap(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_IDS_KEY) ?? '{}')
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
    // Migrate legacy array format
    if (Array.isArray(raw)) {
      const now = Date.now()
      return Object.fromEntries((raw as string[]).map(id => [id, now]))
    }
    return {}
  } catch {
    return {}
  }
}

export function getDeletedIds(): Set<string> {
  const map = readTombstoneMap()
  const now = Date.now()
  const valid = Object.entries(map).filter(([, ts]) => now - ts < TOMBSTONE_TTL_MS)
  return new Set(valid.map(([id]) => id))
}

export function recordDeletedId(id: string) {
  const map = readTombstoneMap()
  const now = Date.now()
  // Prune expired entries while we're here
  const pruned: Record<string, number> = {}
  for (const [k, ts] of Object.entries(map)) {
    if (now - ts < TOMBSTONE_TTL_MS) pruned[k] = ts
  }
  pruned[id] = now
  trySet(DELETED_IDS_KEY, JSON.stringify(pruned))
}

export function removeDeletedId(id: string) {
  const map = readTombstoneMap()
  delete map[id]
  trySet(DELETED_IDS_KEY, JSON.stringify(map))
}

export function loadLinks(): LinkRecord[] {
  try {
    const deleted = getDeletedIds()
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as any[]
    return raw
      .filter(l => l && l.id && !deleted.has(l.id) && !(l.isSaving || l.title === 'Saving link...'))
      .map(l => ({
        ...l,
        summary: l.summary ?? '',
        tags: l.tags ?? [],
        category: normalizeCategory(l.category),
        isSaving: undefined,
      }))
  } catch { return [] }
}

export function saveLinks(links: LinkRecord[]) {
  trySet(STORAGE_KEY, JSON.stringify(links.map(l => ({ ...l, isNew: false }))))
}

// Notes local cache (with tombstone filtering)
export function loadNotes(): NoteRecord[] {
  try {
    const deleted = getDeletedIds()
    const raw = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter(n => n && typeof n === 'object' && n.id && !deleted.has(n.id))
      .map(n => ({
        ...n,
        tags: Array.isArray(n.tags) ? n.tags : [],
        title: typeof n.title === 'string' ? n.title : '',
        content: typeof n.content === 'string' ? n.content : '',
      }))
  } catch { return [] }
}

export function saveNotes(notes: NoteRecord[]) {
  trySet(NOTES_STORAGE_KEY, JSON.stringify(notes.map(n => ({ ...n, isNew: false }))))
}

// Canvas Folders local persistence 
export function loadFolders(): FolderRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter(f => f && typeof f === 'object' && f.id && f.type === 'folder')
      .map(f => ({
        ...f,
        name: typeof f.name === 'string' ? f.name : 'New Folder',
        noteIds: Array.isArray(f.noteIds) ? f.noteIds : [],
        width: typeof f.width === 'number' ? f.width : 72,
        height: typeof f.height === 'number' ? f.height : 54,
        x: typeof f.x === 'number' ? f.x : 100,
        y: typeof f.y === 'number' ? f.y : 100,
      }))
  } catch { return [] }
}

export function saveFolders(folders: FolderRecord[]) {
  trySet(FOLDERS_STORAGE_KEY, JSON.stringify(folders))
}

/** Wipes all user data from localStorage. Call on logout so the next user starts clean. */
export function clearLocalData() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(NOTES_STORAGE_KEY)
  localStorage.removeItem(FOLDERS_STORAGE_KEY)
  localStorage.removeItem(DELETED_IDS_KEY)
}
