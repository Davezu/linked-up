import { useRef, useCallback, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { SpectacularButton } from './react-bits/SpectacularButton'
import { animateSpectacularFilterThumb } from './react-bits/animations'

function countForFilter(
  filter: string,
  links: { status?: string; category: string }[],
) {
  if (filter === 'All') return links.length
  if (filter === 'To Watch') return links.filter(l => l.status === 'To Watch' || !l.status).length
  if (filter === 'Finished') return links.filter(l => l.status === 'Finished').length
  if (filter === 'Favorites') return links.filter(l => l.status === 'Favorite').length
  return links.filter(l => l.category === filter).length
}

export function FilterPillList({
  filters,
  activeFilter,
  onSelect,
  links,
  variant = 'default',
}: {
  filters: string[]
  activeFilter: string
  onSelect: (filter: string) => void
  links?: { status?: string; category: string }[]
  variant?: 'default' | 'nav'
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  const updateThumb = useCallback(() => {
    if (variant !== 'nav' || !thumbRef.current || !trackRef.current) return
    const activeEl = pillRefs.current.get(activeFilter)
    if (!activeEl) {
      gsap.to(thumbRef.current, { opacity: 0, duration: 0.2 })
      return
    }
    gsap.set(thumbRef.current, { opacity: 1 })
    const trackRect = trackRef.current.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()
    animateSpectacularFilterThumb(
      thumbRef.current,
      activeRect.left - trackRect.left,
      activeRect.width,
    )
  }, [activeFilter, variant])

  useLayoutEffect(() => {
    updateThumb()
  }, [updateThumb, filters])

  useLayoutEffect(() => {
    if (variant !== 'nav') return
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(() => updateThumb())
    observer.observe(track)
    window.addEventListener('resize', updateThumb)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateThumb)
    }
  }, [variant, updateThumb])

  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = filters.indexOf(activeFilter)
    if (currentIndex === -1) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = filters[Math.min(currentIndex + 1, filters.length - 1)]
      if (next && next !== activeFilter) {
        onSelect(next)
        pillRefs.current.get(next)?.focus()
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = filters[Math.max(currentIndex - 1, 0)]
      if (prev && prev !== activeFilter) {
        onSelect(prev)
        pillRefs.current.get(prev)?.focus()
      }
    }
  }, [filters, activeFilter, onSelect])

  return (
    <div
      className={`filter-pill-bar overflow-x-auto overflow-y-hidden outline-none${variant === 'nav' ? ' filter-pill-bar--nav' : ''}`}
      ref={scrollRef}
      role="tablist"
      aria-label="Filter links"
      tabIndex={0}
      onKeyDown={handleListKeyDown}
    >
      <div
        ref={trackRef}
        className={
          variant === 'nav'
            ? 'filter-pill-track spectacular-filter-track'
            : 'flex gap-1.5 px-3 w-max min-w-full filter-pill-track'
        }
      >
        {variant === 'nav' && (
          <div ref={thumbRef} className="spectacular-filter-thumb" aria-hidden="true" />
        )}
        {filters.map(filter => {
          const count = links ? countForFilter(filter, links) : null
          const isActive = activeFilter === filter

          if (variant === 'nav') {
            return (
              <SpectacularButton
                key={filter}
                ref={el => {
                  if (el) pillRefs.current.set(filter, el)
                  else pillRefs.current.delete(filter)
                }}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                active={isActive}
                onClick={() => onSelect(filter)}
              >
                {filter}
                {count !== null && (
                  <span className="filter-pill-count">{count}</span>
                )}
              </SpectacularButton>
            )
          }

          return (
          <button
            key={filter}
            ref={el => {
              if (el) pillRefs.current.set(filter, el)
              else pillRefs.current.delete(filter)
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`flex-shrink-0 px-3.5 py-2.5 rounded-[var(--radius-sm)] border text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-150 filter-pill ${isActive ? 'bg-[var(--chip-bg-active)] text-[var(--chip-text-active)] border-transparent font-semibold shadow-md active' : 'bg-[var(--chip-bg)] text-[var(--chip-text)] border-[var(--chip-border)] hover:bg-[var(--chip-bg-hover)] hover:text-[var(--chip-text-active)]'}`}
            onClick={() => onSelect(filter)}
          >
            {filter}
            {count !== null && (
              <span className="filter-pill-count">{count}</span>
            )}
          </button>
          )
        })}
      </div>
    </div>
  )
}
