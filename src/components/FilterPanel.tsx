import { ChevronRight, ChevronLeft } from 'lucide-react'

interface FilterPanelProps {
  isOpen: boolean
  onToggle: () => void
  activeFilter: string
  onSelectFilter: (f: string) => void
  statusFilters: readonly string[]
  categories: string[]
  links: { status?: string; category: string }[]
}

function countForFilter(
  filter: string,
  links: { status?: string; category: string }[]
) {
  if (filter === 'All') return links.length
  if (filter === 'To Watch') return links.filter(l => l.status === 'To Watch' || !l.status).length
  if (filter === 'Finished') return links.filter(l => l.status === 'Finished').length
  if (filter === 'Favorites') return links.filter(l => l.status === 'Favorite').length
  return links.filter(l => l.category === filter).length
}

export function FilterPanel({
  isOpen,
  onToggle,
  activeFilter,
  onSelectFilter,
  statusFilters,
  categories,
  links,
}: FilterPanelProps) {
  return (
    <div className={`filter-panel flex relative overflow-hidden transition-all ${isOpen ? 'filter-panel--open' : ''}`} aria-label="Filter panel">
      {/* Toggle arrow button */}
      <button
        id="filter-panel-toggle"
        className="filter-panel-toggle flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse filters' : 'Expand filters'}
        title={isOpen ? 'Collapse' : 'Show filters'}
      >
        {isOpen
          ? <ChevronLeft size={14} strokeWidth={2} />
          : <ChevronRight size={14} strokeWidth={2} />
        }
      </button>

      {/* Panel content */}
      <div className="filter-panel-content flex flex-col overflow-y-auto transition-opacity" aria-hidden={!isOpen}>
        <p className="filter-panel-section-label uppercase font-bold tracking-wider">Status</p>
        {statusFilters.map(f => {
          const count = countForFilter(f, links)
          return (
            <button
              key={f}
              className={`filter-panel-item flex items-center justify-between w-full text-left transition-all ${activeFilter === f ? 'filter-panel-item--active' : ''}`}
              onClick={() => onSelectFilter(f)}
              aria-pressed={activeFilter === f}
            >
              <span className="filter-panel-item-label truncate">{f}</span>
              <span className="filter-panel-item-badge rounded-full">{count}</span>
            </button>
          )
        })}

        {categories.length > 0 && (
          <>
            <p className="filter-panel-section-label uppercase font-bold tracking-wider" style={{ marginTop: 16 }}>Categories</p>
            {categories.map(cat => {
              const count = countForFilter(cat, links)
              return (
                <button
                  key={cat}
                  className={`filter-panel-item flex items-center justify-between w-full text-left transition-all ${activeFilter === cat ? 'filter-panel-item--active' : ''}`}
                  onClick={() => onSelectFilter(cat)}
                  aria-pressed={activeFilter === cat}
                >
                  <span className="filter-panel-item-label truncate">{cat}</span>
                  <span className="filter-panel-item-badge rounded-full">{count}</span>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
