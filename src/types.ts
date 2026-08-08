export interface LinkRecord {
  id: string
  url: string
  title: string
  description: string
  image: string | null
  category: string
  summary: string
  tags: string[]
  created_at: string
  status?: string
  isNew?: boolean
  processing?: boolean
}

export interface NoteRecord {
  id: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
  isNew?: boolean
  /** Sticky note color hex code or css var */
  color?: string
  /** Canvas X position (persisted in localStorage only) */
  x?: number
  /** Canvas Y position (persisted in localStorage only) */
  y?: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: { id: string; title: string; url: string; category: string }[]
  timestamp: Date
}

