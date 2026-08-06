import type { LinkRecord } from '../types'

export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export function getFaviconUrl(url: string): string {
  try { const { origin } = new URL(url); return `https://www.google.com/s2/favicons?domain=${origin}&sz=32` } catch { return '' }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function formatCarouselBadge(text: string): string {
  return text.replace(/[^\w\s#&]/g, '').trim().toUpperCase() || 'LINK'
}

// ── Related content (shared category / tags) ────────────────────────────
export function getRelated(link: LinkRecord, allLinks: LinkRecord[]): LinkRecord[] {
  return allLinks
    .filter(l => l.id !== link.id)
    .map(l => {
      let score = 0
      if (l.category === link.category) score += 3
      const sharedTags = l.tags.filter(t => link.tags.includes(t))
      score += sharedTags.length * 2
      return { link: l, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.link)
}

export function delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }
