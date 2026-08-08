import { Sun, Moon, BookMarked, StickyNote } from 'lucide-react'

type AppView = 'library' | 'notes' | 'chat'

interface TopNavProps {
  activeView: AppView
  onViewChange: (v: AppView) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  notesCount: number
  linksCount: number
}

export function TopNav({
  activeView,
  onViewChange,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  notesCount,
  linksCount,
}: TopNavProps) {
  return (
    <nav className="flex items-center justify-between h-[52px] px-4 md:px-6 bg-[var(--header-bg)] border-b border-[var(--border)] shrink-0 z-30 relative backdrop-blur-md transition-colors" aria-label="Main navigation">
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <img src="/logo.svg" alt="Personal Space" className="w-[26px] h-[26px] object-contain" />
        <span className="font-['Space_Grotesk',sans-serif] font-bold text-[1.05rem] tracking-tight bg-[var(--header-title-gradient)] bg-clip-text text-transparent">
          Personal Space
        </span>
      </div>

      {/* Search — visible in library or notes view */}
      <div className="flex-1 max-w-[380px] flex items-start mx-4">
        {(activeView === 'library' || activeView === 'notes') && (
          <input
            type="search"
            className="w-full h-[34px] bg-[var(--bg-input)] border border-[var(--border)] rounded-[var(--radius-md)] px-3.5 text-[0.8125rem] text-[var(--text-main)] transition-all duration-200 focus:outline-none focus:border-[var(--border-hover)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            placeholder="Search links..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search links"
          />
        )}
      </div>

      {/* Nav Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          id="nav-links-btn"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[0.8125rem] font-medium transition-all duration-200 cursor-pointer border ${activeView === 'library'
            ? 'bg-[var(--nav-bg-active)] text-[var(--nav-icon-active)] border-[var(--border)] shadow-sm font-semibold'
            : 'bg-transparent text-[var(--text-dim)] border-transparent hover:bg-[var(--nav-bg-hover)] hover:text-[var(--text-main)]'
            }`}
          onClick={() => onViewChange('library')}
          aria-label="Go to Links"
          title="Links"
        >
          <BookMarked size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Links</span>
          {linksCount > 0 && (
            <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full bg-[var(--badge-bg)] text-[var(--text-muted)] font-semibold">
              {linksCount}
            </span>
          )}
        </button>

        <button
          id="nav-notes-btn"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[0.8125rem] font-medium transition-all duration-200 cursor-pointer border ${activeView === 'notes'
            ? 'bg-[var(--nav-bg-active)] text-[var(--nav-icon-active)] border-[var(--border)] shadow-sm font-semibold'
            : 'bg-transparent text-[var(--text-dim)] border-transparent hover:bg-[var(--nav-bg-hover)] hover:text-[var(--text-main)]'
            }`}
          onClick={() => onViewChange('notes')}
          aria-label="Go to Notes"
          title="Notes"
        >
          <StickyNote size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Notes</span>
          {notesCount > 0 && (
            <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full bg-[var(--badge-bg)] text-[var(--text-muted)] font-semibold">
              {notesCount}
            </span>
          )}
        </button>

        <button
          id="theme-toggle-btn"
          className="flex items-center justify-center w-[34px] h-[34px] rounded-[var(--radius-md)] bg-[var(--toggle-bg)] text-[var(--text-main)] border border-[var(--border)] cursor-pointer hover:bg-[var(--toggle-bg-hover)] transition-all duration-200"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark'
            ? <Sun size={16} strokeWidth={1.75} />
            : <Moon size={16} strokeWidth={1.75} />
          }
        </button>
      </div>
    </nav>
  )
}
