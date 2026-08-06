import { useRef, useCallback } from 'react'

export function FilterPillList({
  filters,
  activeFilter,
  onSelect,
}: {
  filters: string[]
  activeFilter: string
  onSelect: (filter: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

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
      className="filter-pill-bar overflow-x-auto overflow-y-hidden outline-none"
      ref={scrollRef}
      role="tablist"
      aria-label="Filter links"
      tabIndex={0}
      onKeyDown={handleListKeyDown}
    >
      <div className="flex gap-1.5 px-3 w-max min-w-full filter-pill-track">
        {filters.map(filter => (
          <button
            key={filter}
            ref={el => {
              if (el) pillRefs.current.set(filter, el)
              else pillRefs.current.delete(filter)
            }}
            role="tab"
            aria-selected={activeFilter === filter}
            tabIndex={activeFilter === filter ? 0 : -1}
            className={`flex-shrink-0 px-3.5 py-2.5 rounded-[var(--radius-sm)] border text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-150 filter-pill ${activeFilter === filter ? 'bg-[var(--chip-bg-active)] text-[var(--chip-text-active)] border-transparent font-semibold shadow-md active' : 'bg-[var(--chip-bg)] text-[var(--chip-text)] border-[var(--chip-border)] hover:bg-[var(--chip-bg-hover)] hover:text-[var(--chip-text-active)]'}`}
            onClick={() => onSelect(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  )
}
