import { Search, Plus, Bell, Sparkles, Link2, FileText, Sun, Moon, ChevronDown } from 'lucide-react'

type AppView = 'library' | 'notes' | 'chat'

interface TopNavProps {
  activeView: AppView
  onViewChange: (v: AppView) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  notesCount: number
  linksCount: number
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onNewClick?: () => void
  onNotificationsClick?: () => void
  onAssistantClick?: () => void
  onLogoClick?: () => void
  hasUnread?: boolean
  appName?: string
}

export function TopNav({
  activeView,
  onViewChange,
  searchQuery,
  onSearchChange,
  notesCount,
  linksCount,
  theme,
  onToggleTheme,
  onNewClick,
  onNotificationsClick,
  onAssistantClick,
  onLogoClick,
  hasUnread = true,
  appName = 'Dashio',
}: TopNavProps) {
  return (
    <nav
      className="flex items-center justify-between gap-2 sm:gap-4 h-14 px-3 sm:px-5 shrink-0 border-b backdrop-blur-md z-40 bg-[var(--bg-sidebar)] border-[var(--border)] overflow-hidden"
      aria-label="Main navigation"
    >
      {/* Left — logo, divider, nav tabs */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="top-nav-logo">
          <img src="/logo.svg" alt={appName} className="top-nav-logo-img" />
          <span className="top-nav-logo-name hidden xs:inline">{appName}</span>
        </div>

        <div className="top-nav-divider" aria-hidden="true" />

        <div className="tab-switcher">
          <button
            id="nav-links-btn"
            className={`tab-switch-btn ${activeView === 'library' ? 'tab-switch-btn--active-neutral' : ''}`}
            onClick={() => onViewChange('library')}
            aria-label="Go to Links"
            title="Links"
          >
            <Link2 size={12} strokeWidth={2} aria-hidden="true" />
            Links
          </button>

          <button
            id="nav-notes-btn"
            className={`tab-switch-btn ${activeView === 'notes' ? 'tab-switch-btn--active-accent' : ''}`}
            onClick={() => onViewChange('notes')}
            aria-label="Go to Notes"
            title="Notes"
          >
            <FileText size={12} strokeWidth={2} aria-hidden="true" />
            Notes
            {notesCount > 0 && (
              <span className={`tab-switch-badge ${activeView === 'notes' ? 'tab-switch-badge--active' : ''}`}>
                {notesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Center — search */}
      <div className="hidden sm:flex flex-1 justify-center min-w-0 px-2">
        <div className="search-bar-wrap">
          <Search size={14} strokeWidth={2} className="search-bar-icon" aria-hidden="true" />
          <input
            type="search"
            className="search-bar-input"
            placeholder="Search links and notes..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search links and notes"
          />
          <kbd className="search-bar-kbd hidden md:flex">⌘K</kbd>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          id="theme-toggle-btn"
          className="flex items-center justify-center w-9 h-9 shrink-0 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200 bg-[var(--toggle-bg)] border border-[var(--border)] text-[var(--text-main)] hover:bg-[var(--toggle-bg-hover)]"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark'
            ? <Sun size={16} strokeWidth={2} />
            : <Moon size={16} strokeWidth={2} />
          }
        </button>
      </div>
    </nav>
  )
}