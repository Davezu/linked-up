import { Search, Link2, FileText, Sun, Moon, Palette, Check, LogOut } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PALETTES, type ColorPalette } from '../lib/palettes'
import { animatePaletteMenuOpen } from './react-bits/animations'
import { FilterPillList } from './FilterPillList'
import { CategoryFilterDropdown } from './CategoryFilterDropdown'

const PALETTE_MENU_GAP = 6

type AppView = 'library' | 'notes' | 'chat'

interface TopNavProps {
  activeView: AppView
  onViewChange: (v: AppView) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  notesCount: number
  linksCount: number
  activeFilter?: string
  onFilterChange?: (filter: string) => void
  statusFilters?: readonly string[]
  categories?: string[]
  filterLinks?: { status?: string; category: string }[]
  theme: 'light' | 'dark'
  onToggleTheme: (originEl: HTMLElement | null) => void
  palette: ColorPalette
  onPaletteChange: (palette: ColorPalette) => void
  onNewClick?: () => void
  onNotificationsClick?: () => void
  onAssistantClick?: () => void
  onLogoClick?: () => void
  onLogout?: () => void
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
  activeFilter = 'All',
  onFilterChange,
  statusFilters = [],
  categories = [],
  filterLinks = [],
  theme,
  onToggleTheme,
  palette,
  onPaletteChange,
  onNewClick,
  onNotificationsClick,
  onAssistantClick,
  onLogoClick,
  onLogout,
  hasUnread = true,
  appName = 'Dashio',
}: TopNavProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const themeBtnRef = useRef<HTMLButtonElement>(null)

  function togglePalette() {
    setPaletteOpen(open => {
      const next = !open
      if (next && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setMenuPos({
          top: rect.bottom + PALETTE_MENU_GAP,
          right: window.innerWidth - rect.right,
        })
      } else if (!next) {
        setMenuPos(null)
      }
      return next
    })
  }

  useLayoutEffect(() => {
    if (!paletteOpen || !menuRef.current) return
    animatePaletteMenuOpen(menuRef.current, triggerRef.current)
  }, [paletteOpen, menuPos])

  useEffect(() => {
    if (!paletteOpen) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + PALETTE_MENU_GAP,
        right: window.innerWidth - rect.right,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (paletteRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setPaletteOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPaletteOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [paletteOpen])

  const activePalette = PALETTES.find(p => p.id === palette) ?? PALETTES[0]

  function handleThemeToggle() {
    onToggleTheme(themeBtnRef.current)
  }

  return (
    <nav
      className="top-nav-bar flex items-center justify-between gap-2 sm:gap-4 h-14 px-3 sm:px-5 shrink-0 z-40"
      aria-label="Main navigation"
    >
      {/* Left — logo, project name, divider, nav tabs */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer hover:opacity-95 transition-opacity shrink-0" onClick={onLogoClick}>
          <img src="/logo.svg" alt="Linked Up" className="top-nav-logo-img" />
          <span className="hidden sm:flex items-center text-lg sm:text-xl font-bold tracking-tight text-[var(--text-main)] select-none">
            <span>Linked</span>
            <span className="inline-flex items-center justify-center mx-[2px] text-amber-500 hover:scale-110 transition-transform duration-200" title="Linked Up">
              <svg width="20" height="15" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block stroke-current">
                <path d="M9 12H7A4 4 0 0 1 7 4h2a4 4 0 0 1 3.8 2.8" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M15 4h2a4 4 0 0 1 0 8h-2a4 4 0 0 1-3.8-2.8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="8" y1="8" x2="16" y2="8" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-amber-500 font-extrabold">up</span>
          </span>
        </div>

        <div className="top-nav-divider hidden sm:block" aria-hidden="true" />

        <div className="tab-switcher">
          <div
            className={`tab-switcher-thumb${activeView === 'notes' ? ' tab-switcher-thumb--notes tab-switcher-thumb--accent' : ' tab-switcher-thumb--links tab-switcher-thumb--neutral'}`}
            aria-hidden="true"
          />
          <button
            id="nav-links-btn"
            className={`tab-switch-btn${activeView === 'library' ? ' tab-switch-btn--active' : ''}`}
            onClick={() => onViewChange('library')}
            aria-label="Go to Links"
            aria-current={activeView === 'library' ? 'page' : undefined}
            title="Links"
          >
            <Link2 size={12} strokeWidth={2} aria-hidden="true" />
            Links
          </button>

          <button
            id="nav-notes-btn"
            className={`tab-switch-btn${activeView === 'notes' ? ' tab-switch-btn--active' : ''}`}
            onClick={() => onViewChange('notes')}
            aria-label="Go to Notes"
            aria-current={activeView === 'notes' ? 'page' : undefined}
            title="Notes"
          >
            <FileText size={12} strokeWidth={2} aria-hidden="true" />
            Notes
            {notesCount > 0 && (
              <span className={`tab-switch-badge${activeView === 'notes' ? ' tab-switch-badge--active' : ''}`}>
                {notesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters — links view only, after tab switcher */}
      {activeView === 'library' && onFilterChange && (statusFilters.length > 0 || categories.length > 0) && (
        <div className="top-nav-filters">
          {statusFilters.length > 0 && (
            <FilterPillList
              filters={[...statusFilters]}
              activeFilter={activeFilter}
              onSelect={onFilterChange}
              links={filterLinks}
              variant="nav"
            />
          )}
          {categories.length > 0 && (
            <CategoryFilterDropdown
              categories={categories}
              activeFilter={activeFilter}
              onSelect={onFilterChange}
              links={filterLinks}
            />
          )}
        </div>
      )}

      {/* Center — search (links view only) */}
      {activeView === 'library' && (
        <div className="hidden sm:flex shrink-0 min-w-0 px-2">
          <div className="search-bar-wrap w-[240px] lg:w-[300px]">
            <Search size={14} strokeWidth={2} className="search-bar-icon" aria-hidden="true" />
            <input
              type="search"
              className="search-bar-input"
              placeholder="Search links..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              aria-label="Search links"
            />
            <kbd className="search-bar-kbd hidden md:flex">⌘K</kbd>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <div
          className={`palette-picker${paletteOpen ? ' palette-picker--open' : ''}`}
          ref={paletteRef}
        >
          <button
            ref={triggerRef}
            id="palette-toggle-btn"
            type="button"
            className="palette-picker-trigger top-nav-icon-btn"
            onClick={togglePalette}
            aria-label={`Color palette: ${activePalette.label}`}
            aria-haspopup="listbox"
            aria-expanded={paletteOpen}
            title="Choose color palette"
          >
            <Palette size={16} strokeWidth={2} />
            <span
              className="palette-picker-swatch"
              style={{ background: activePalette.swatch }}
              aria-hidden="true"
            />
          </button>
          {paletteOpen && menuPos && createPortal(
            <div
              ref={menuRef}
              className="palette-picker-popover"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <div
                className="palette-picker-menu"
                role="listbox"
                aria-label="Color palettes"
              >
              {PALETTES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={palette === item.id}
                  className={`palette-picker-option${palette === item.id ? ' palette-picker-option--active' : ''}`}
                  onClick={() => {
                    onPaletteChange(item.id)
                    setPaletteOpen(false)
                  }}
                >
                  <span className="palette-picker-option-swatch" style={{ background: item.swatch }} aria-hidden="true" />
                  <span className="palette-picker-option-label">{item.label}</span>
                  {palette === item.id && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                </button>
              ))}
              </div>
            </div>,
            document.body,
          )}
        </div>
        <button
          ref={themeBtnRef}
          id="theme-toggle-btn"
          type="button"
          className="top-nav-icon-btn"
          onClick={handleThemeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark'
            ? <Sun size={16} strokeWidth={2} />
            : <Moon size={16} strokeWidth={2} />
          }
        </button>
        {onLogout && (
          <button
            id="logout-btn"
            type="button"
            className="top-nav-icon-btn"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        )}
      </div>
    </nav>
  )
}