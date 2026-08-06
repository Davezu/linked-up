import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { LinkRecord } from '../types'
import { LinkCard } from './LinkCard'

export function LinkFan({
  items, allLinks, onDelete, onStatusChange
}: {
  items: LinkRecord[]
  allLinks: LinkRecord[]
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [active, setActive] = useState(0)

  // Use item IDs key so theme changes or parent re-renders don't reset the active card index
  const itemIdsKey = items.map(i => i.id).join(',')

  useEffect(() => {
    setActive(prev => Math.min(prev, Math.max(0, items.length - 1)))
  }, [itemIdsKey, items.length])

  if (items.length === 0) return null

  const getPosClass = (i: number) => {
    const n = items.length
    if (n === 1) return 'link-fan-card--center'
    if (n === 2) {
      if (i === active) return 'link-fan-card--center'
      return 'link-fan-card--right'
    }

    const diff = ((i - active) % n + n) % n
    if (diff === 0) return 'link-fan-card--center'
    if (diff === 1) return 'link-fan-card--right'
    if (diff === n - 1) return 'link-fan-card--left'
    return 'link-fan-card--hidden'
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActive((prev) => (prev - 1 + items.length) % items.length)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActive((prev) => (prev + 1) % items.length)
  }

  return (
    <div className="link-fan-wrap">
      <div className="link-fan">
        {items.length > 1 && (
          <button className="link-fan-nav link-fan-nav--left" onClick={handlePrev} aria-label="Previous link">
            <ChevronLeft size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {items.map((link, i) => {
          const posClass = getPosClass(i)
          return (
            <div
              key={link.id}
              className={`link-fan-card ${posClass}`}
              onClick={() => setActive(i)}
            >
              <LinkCard
                link={link}
                allLinks={allLinks}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            </div>
          )
        })}

        {items.length > 1 && (
          <button className="link-fan-nav link-fan-nav--right" onClick={handleNext} aria-label="Next link">
            <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="link-dots">
          {items.map((_, i) => (
            <button
              key={i}
              className={`link-dot ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Go to item ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
