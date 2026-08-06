import type { LinkRecord } from '../types'
import { STORAGE_KEY, LEGACY_CATEGORY_MAP } from './constants'

export function normalizeCategory(category: string): string {
  const mapped = LEGACY_CATEGORY_MAP[category] ?? category
  const lower = mapped.toLowerCase()
  if (lower.includes('dog') || lower.includes('cat') || lower.includes('animal') || lower.includes('pet')) {
    return '🐾 Pets'
  }
  return mapped
}

const DELETED_IDS_KEY = 'link-organizer-deleted-ids'

export function getDeletedIds(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_IDS_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw : [])
  } catch {
    return new Set()
  }
}

export function recordDeletedId(id: string) {
  const set = getDeletedIds()
  set.add(id)
  localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)))
}

export function removeDeletedId(id: string) {
  const set = getDeletedIds()
  set.delete(id)
  localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)))
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links.map(l => ({ ...l, isNew: false }))))
}
