export const STORAGE_KEY = 'link-organizer-links'
export const NOTES_STORAGE_KEY = 'link-organizer-notes'
export const FOLDERS_STORAGE_KEY = 'link-organizer-folders'
export const API_UNAVAILABLE_KEY = 'link-organizer-api-unavailable'

export const API_BASE = import.meta.env.VITE_API_BASE ?? ''
export const AI_API_BASE = import.meta.env.VITE_AI_API_BASE ?? ''
export const LOAD_FROM_API = import.meta.env.VITE_LOAD_FROM_API === 'true'

export const STATUS_FILTERS = ['All', 'To Watch', 'Finished', 'Favorites'] as const

export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'Food': '🍜 Food', 'Coding': '💻 Coding', 'Movies': '🎥 Videos',
  'Shopping': '🛍️ Shopping', 'Travel': '✈️ Travel', 'Other': '📎 Other',
}
