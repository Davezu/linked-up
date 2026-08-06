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

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: { id: string; title: string; url: string; category: string }[]
  timestamp: Date
}
