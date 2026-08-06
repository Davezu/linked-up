import { Sparkles, Library } from 'lucide-react'

export function MobileBottomNav({
  activeView,
  onViewChange,
}: {
  activeView: 'library' | 'chat'
  onViewChange: (view: 'library' | 'chat') => void
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 w-full grid grid-cols-2 items-stretch bg-[var(--mobile-nav-bg)] border-t border-[var(--border)] backdrop-blur-lg mobile-bottom-nav" aria-label="Main navigation">
      <button
        type="button"
        className={`flex flex-col items-center justify-center gap-1 w-full min-h-[56px] p-2 text-xs font-medium border-none cursor-pointer transition-all nav-tab ${activeView === 'library' ? 'text-[var(--nav-icon-active)] bg-[var(--nav-bg-active)] active' : 'text-[var(--nav-icon)] hover:text-[var(--nav-icon-hover)] hover:bg-[var(--nav-bg-hover)]'}`}
        onClick={() => onViewChange('library')}
        aria-current={activeView === 'library' ? 'page' : undefined}
      >
        <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 nav-tab-icon" aria-hidden="true">
          <Library size={22} strokeWidth={1.75} />
        </span>
        <span className="block leading-tight whitespace-nowrap nav-tab-label-text">Library</span>
      </button>
      <button
        type="button"
        className={`flex flex-col items-center justify-center gap-1 w-full min-h-[56px] p-2 text-xs font-medium border-none cursor-pointer transition-all nav-tab ${activeView === 'chat' ? 'text-[var(--nav-icon-active)] bg-[var(--nav-bg-active)] active' : 'text-[var(--nav-icon)] hover:text-[var(--nav-icon-hover)] hover:bg-[var(--nav-bg-hover)]'}`}
        onClick={() => onViewChange('chat')}
        aria-current={activeView === 'chat' ? 'page' : undefined}
      >
        <span className="flex items-center justify-center w-6 h-6 flex-shrink-0 nav-tab-icon" aria-hidden="true">
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
        <span className="block leading-tight whitespace-nowrap nav-tab-label-text">Ask AI</span>
      </button>
    </nav>
  )
}
