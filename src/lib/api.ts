import type { LinkRecord } from '../types'
import { API_BASE, LOAD_FROM_API, API_UNAVAILABLE_KEY } from './constants'
import { authHeaders, clearToken } from './auth/tokenStorage'

export function isApiSyncEnabled(): boolean {
  return Boolean(API_BASE) && LOAD_FROM_API
}

export function markApiUnavailable() {
  sessionStorage.setItem(API_UNAVAILABLE_KEY, '1')
}

export function clearApiUnavailable() {
  sessionStorage.removeItem(API_UNAVAILABLE_KEY)
}

export function isApiFetchBlocked(): boolean {
  return sessionStorage.getItem(API_UNAVAILABLE_KEY) === '1'
}

export async function apiMutate(init: RequestInit): Promise<boolean> {
  if (!isApiSyncEnabled()) return false
  try {
    const res = await fetch(API_BASE, { ...init, headers: { ...init.headers, ...authHeaders() } })
    if (res.status === 401) {
      clearToken()
      return false
    }
    if (res.status === 404) {
      markApiUnavailable()
      return false
    }
    return res.ok
  } catch {
    return false
  }
}

export async function fetchLinksFromApi(signal?: AbortSignal): Promise<LinkRecord[] | null> {
  if (!API_BASE || !LOAD_FROM_API) return null
  if (isApiFetchBlocked()) return null

  try {
    const res = await fetch(`${API_BASE}/links`, { signal, headers: { ...authHeaders() } })
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
    const list = Array.isArray(data) ? data : Array.isArray(data?.links) ? data.links : Array.isArray(data?.items) ? data.items : null
    if (!list) return null
    return list
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    return null
  }
}

export function buildRecordFromAi(url: string, aiData: Record<string, unknown>, id: string): LinkRecord {
  return {
    id,
    url,
    title: String(aiData.title || url),
    description: String(aiData.description || ''),
    image: (aiData.image as string | null) ?? null,
    category: String(aiData.category || '📎 Other'),
    summary: String(aiData.summary || ''),
    tags: Array.isArray(aiData.tags) ? aiData.tags as string[] : [],
    created_at: new Date().toISOString(),
    status: 'To Watch',
  }
}