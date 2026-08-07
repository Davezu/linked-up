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
    <nav className="top-nav" aria-label="Main navigation">
      {/* Brand */}
      <div className="top-nav-brand">
        <img src="/logo.svg" alt="Knowledge Vault" className="top-nav-logo" />
        <span className="top-nav-appname">Knowledge Vault</span>
      </div>

      {/* Search — only visible in library view */}
      <div className="top-nav-search-wrap">
        {activeView === 'library' && (
          <input
            type="search"
            className="top-nav-search"
            placeholder="Search links..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search links"
          />
        )}
        {activeView === 'notes' && (
          <span className="top-nav-view-label">Notes</span>
        )}
      </div>

      {/* Nav Actions */}
      <div className="top-nav-actions">
        <button
          id="nav-links-btn"
          className={`top-nav-btn ${activeView === 'library' ? 'top-nav-btn--active' : ''}`}
          onClick={() => onViewChange('library')}
          aria-label="Go to Links"
          title="Links"
        >
          <BookMarked size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Links</span>
          {linksCount > 0 && (
            <span className="top-nav-badge">{linksCount}</span>
          )}
        </button>

        <button
          id="nav-notes-btn"
          className={`top-nav-btn ${activeView === 'notes' ? 'top-nav-btn--active' : ''}`}
          onClick={() => onViewChange('notes')}
          aria-label="Go to Notes"
          title="Notes"
        >
          <StickyNote size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>Notes</span>
          {notesCount > 0 && (
            <span className="top-nav-badge">{notesCount}</span>
          )}
        </button>

        <button
          id="theme-toggle-btn"
          className="top-nav-theme-toggle"
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
