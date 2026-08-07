import type { LinkRecord, NoteRecord } from '../types'
import { STORAGE_KEY, NOTES_STORAGE_KEY, LEGACY_CATEGORY_MAP } from './constants'

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

// Fix 2: Safe localStorage.setItem — swallows QuotaExceededError gracefully
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

// Fix 1: Tombstones stored as { [id]: timestamp } — entries expire after 7 days
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
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as any[]
    return raw
      .filter(l => l && l.id && !(l.isSaving || l.title === 'Saving link...'))
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

// ── Notes local cache (with tombstone filtering) ─────────────────────────
export function loadNotes(): NoteRecord[] {
  try {
    const deleted = getDeletedIds()
    const raw = JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) ?? '[]') as any[]
    return raw
      .filter(n => n && n.id && !deleted.has(n.id))
      .map(n => ({
        ...n,
        tags: n.tags ?? [],
        title: n.title ?? '',
        content: n.content ?? '',
      }))
  } catch { return [] }
}

export function saveNotes(notes: NoteRecord[]) {
  trySet(NOTES_STORAGE_KEY, JSON.stringify(notes.map(n => ({ ...n, isNew: false }))))
}
