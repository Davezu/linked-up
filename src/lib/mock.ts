import type { LinkRecord } from '../types'
import { generateId } from './helpers'
import { normalizeCategory } from './storage'

export function makeMockRecord(url: string): LinkRecord {
  const hostname = (() => { try { return new URL(url).hostname } catch { return '' } })()
  const DOMAIN_MAP: Record<string, { cat: string, tags: string[] }> = {
    'tiktok.com': { cat: '📱 Social', tags: ['video', 'social'] },
    'youtube.com': { cat: '🎥 Videos', tags: ['video', 'youtube'] },
    'youtu.be': { cat: '🎥 Videos', tags: ['video', 'youtube'] },
    'github.com': { cat: '💻 Coding', tags: ['dev', 'open-source'] },
    'amazon.com': { cat: '🛍️ Shopping', tags: ['store', 'products'] },
    'airbnb.com': { cat: '✈️ Travel', tags: ['booking', 'stay'] },
    'reddit.com': { cat: '💬 Community', tags: ['forum', 'discussion'] },
    'instagram.com': { cat: '📱 Social', tags: ['photos', 'social'] },
  }
  const match = Object.entries(DOMAIN_MAP).find(([d]) => hostname.includes(d))?.[1]
  const category = normalizeCategory(match?.cat ?? '📎 Other')
  const tags = match?.tags ?? ['link']
  return {
    id: generateId(), url, title: `Link from ${hostname || url}`,
    description: 'Raw description metadata goes here...',
    summary: 'This is a local AI-generated mock summary. Connect to AWS to get real summaries!',
    image: null, category, tags, created_at: new Date().toISOString(),
  }
}
