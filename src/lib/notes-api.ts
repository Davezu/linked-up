import type { NoteRecord } from '../types'
import { API_BASE, LOAD_FROM_API } from './constants'
import { authHeaders, clearToken } from './auth/tokenStorage'
import { clearApiUnavailable, isApiFetchBlocked, isApiSyncEnabled, markApiUnavailable } from './api'

const NOTES_BASE = () => `${API_BASE}/notes`

type NoteApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function parseApiError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  return typeof body?.message === 'string' ? body.message : `Request failed (${res.status})`
}

export async function fetchNotesFromApi(signal?: AbortSignal): Promise<NoteRecord[] | null> {
  if (!API_BASE || !LOAD_FROM_API) return null
  if (isApiFetchBlocked()) return null

  try {
    const res = await fetch(NOTES_BASE(), { signal, headers: { ...authHeaders() } })
    if (res.status === 401) {
      clearToken()
      return null
    }
    if (res.status === 404) {
      markApiUnavailable()
      return null
    }
    if (!res.ok) return null

    clearApiUnavailable()
    const data = await res.json()
    const list = Array.isArray(data) ? data : Array.isArray(data?.notes) ? data.notes : null
    return list as NoteRecord[] | null
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    return null
  }
}

export async function createNoteApi(payload: {
  content: string
  title?: string
  tags?: string[]
}): Promise<NoteApiResult<NoteRecord>> {
  if (!isApiSyncEnabled()) {
    return { ok: false, error: 'Cloud sync is not enabled' }
  }

  try {
    const res = await fetch(NOTES_BASE(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (res.status === 401) {
      clearToken()
      return { ok: false, error: 'Session expired — log in again' }
    }
    if (res.status === 404) {
      markApiUnavailable()
      return { ok: false, error: 'Notes API not found — redeploy the backend' }
    }
    if (!res.ok) {
      return { ok: false, error: await parseApiError(res) }
    }

    clearApiUnavailable()
    const data = await res.json()
    return { ok: true, data: (data.record ?? data) as NoteRecord }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function updateNoteApi(
  id: string,
  payload: { content?: string; title?: string; tags?: string[] },
): Promise<NoteApiResult<void>> {
  if (!isApiSyncEnabled()) {
    return { ok: false, error: 'Cloud sync is not enabled' }
  }

  try {
    const res = await fetch(NOTES_BASE(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, ...payload }),
    })
    if (res.status === 401) {
      clearToken()
      return { ok: false, error: 'Session expired — log in again' }
    }
    if (res.status === 404) {
      markApiUnavailable()
      return { ok: false, error: 'Note not found on server' }
    }
    if (!res.ok) {
      return { ok: false, error: await parseApiError(res) }
    }

    clearApiUnavailable()
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}

export async function deleteNoteApi(id: string): Promise<NoteApiResult<void>> {
  if (!isApiSyncEnabled()) {
    return { ok: false, error: 'Cloud sync is not enabled' }
  }

  try {
    const res = await fetch(NOTES_BASE(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id }),
    })
    if (res.status === 401) {
      clearToken()
      return { ok: false, error: 'Session expired — log in again' }
    }
    if (res.status === 404) {
      markApiUnavailable()
      return { ok: false, error: 'Note not found on server' }
    }
    if (!res.ok) {
      return { ok: false, error: await parseApiError(res) }
    }

    clearApiUnavailable()
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: 'Could not reach the server' }
  }
}
