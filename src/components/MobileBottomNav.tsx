import { Sparkles, Library, NotebookPen } from 'lucide-react'

type AppView = 'library' | 'notes' | 'chat'

const TABS: { id: AppView; label: string; icon: typeof Library }[] = [
  { id: 'library', label: 'Library', icon: Library },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'chat', label: 'Ask AI', icon: Sparkles },
]

export function MobileBottomNav({
  activeView,
  onViewChange,
}: {
  activeView: AppView
  onViewChange: (view: AppView) => void
}) {
  const activeIndex = TABS.findIndex((t) => t.id === activeView)

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {/* Smooth iOS-style sliding active indicator pill */}
      <div
        className="mobile-nav-slider"
        style={{
          position: 'absolute',
          top: 5,
          bottom: 5,
          left: 6,
          width: 'calc(33.3333% - 12px)',
          transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 12}px))`,
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          background: 'color-mix(in srgb, var(--text-main) 12%, var(--mobile-nav-bg))',
          border: '1px solid color-mix(in srgb, var(--text-main) 12%, transparent)',
          borderRadius: 12,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeView === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-tab ${isActive ? 'active' : ''}`}
            style={{ position: 'relative', zIndex: 2 }}
            onClick={() => onViewChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="nav-tab-icon" aria-hidden="true">
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <span className="nav-tab-label-text">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
