import type { NoteRecord } from '../types'
import { API_BASE, LOAD_FROM_API, API_UNAVAILABLE_KEY } from './constants'
import { authHeaders, clearToken } from './auth/tokenStorage'

const NOTES_BASE = () => `${API_BASE}/notes`

function isEnabled(): boolean {
  return Boolean(API_BASE) && LOAD_FROM_API && sessionStorage.getItem(API_UNAVAILABLE_KEY) !== '1'
}

function markUnavailable() {
  sessionStorage.setItem(API_UNAVAILABLE_KEY, '1')
}

export async function fetchNotesFromApi(signal?: AbortSignal): Promise<NoteRecord[] | null> {
  if (!API_BASE || !LOAD_FROM_API) return null
  if (sessionStorage.getItem(API_UNAVAILABLE_KEY) === '1') return null

  try {
    const res = await fetch(NOTES_BASE(), { signal, headers: { ...authHeaders() } })
    if (!res.ok) {
      if (res.status === 401) clearToken()
      if (res.status === 404) markUnavailable()
      return null
    }
    const data = await res.json()
    const list = Array.isArray(data) ? data : Array.isArray(data?.notes) ? data.notes : null
    return list as NoteRecord[] | null
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    return null
  }
}

export async function createNoteApi(payload: { content: string; title?: string; tags?: string[] }): Promise<NoteRecord | null> {
  if (!isEnabled()) return null
  try {
    const res = await fetch(NOTES_BASE(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (res.status === 401) { clearToken(); return null }
    if (res.status === 404) { markUnavailable(); return null }
    if (!res.ok) return null
    const data = await res.json()
    return (data.record ?? data) as NoteRecord
  } catch { return null }
}

export async function updateNoteApi(id: string, payload: { content?: string; title?: string; tags?: string[] }): Promise<boolean> {
  if (!isEnabled()) return false
  try {
    const res = await fetch(NOTES_BASE(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, ...payload }),
    })
    if (res.status === 401) { clearToken(); return false }
    if (res.status === 404) { markUnavailable(); return false }
    return res.ok
  } catch { return false }
}

export async function deleteNoteApi(id: string): Promise<boolean> {
  if (!isEnabled()) return false
  try {
    const res = await fetch(NOTES_BASE(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id }),
    })
    if (res.status === 401) { clearToken(); return false }
    if (res.status === 404) { markUnavailable(); return false }
    return res.ok
  } catch { return false }
}
