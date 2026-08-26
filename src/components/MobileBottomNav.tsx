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
    <nav className="mobile-bottom-nav px-2 py-1.5 min-h-[64px]" aria-label="Main navigation">
      {/* Smooth iOS-style sliding active indicator pill */}
      <div
        className="mobile-nav-slider"
        style={{
          position: 'absolute',
          top: 6,
          bottom: 6,
          left: 8,
          width: 'calc(33.3333% - 16px)',
          transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 16}px))`,
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          background: 'color-mix(in srgb, var(--text-main) 12%, var(--mobile-nav-bg))',
          border: '1px solid color-mix(in srgb, var(--text-main) 12%, transparent)',
          borderRadius: 14,
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
            className={[
              'relative z-[2] flex flex-col items-center justify-center gap-1',
              'w-auto h-[50px] mx-1 my-1 px-3 py-1.5',
              'text-[11px] font-medium leading-tight rounded-xl border-none cursor-pointer',
              'transition-all duration-200',
              isActive ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-muted)]',
              'hover:text-[var(--text-main)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:-outline-offset-2',
            ].join(' ')}
            onClick={() => onViewChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className="flex items-center justify-center w-[20px] h-[20px] shrink-0"
              aria-hidden="true"
            >
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <span className="block leading-none whitespace-nowrap pt-[2px] pb-[1px]">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
