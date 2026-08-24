import { Search, Link2, FileText, Sun, Moon, Palette, Check, LogOut, Pipette } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PALETTES, type ColorPalette } from '../lib/palettes'
import { animatePaletteMenuOpen } from './react-bits/animations'
import { FilterPillList } from './FilterPillList'
import { CategoryFilterDropdown } from './CategoryFilterDropdown'
import type { NoteRecord } from '../types'

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
  notes?: NoteRecord[]
  activeFolder?: string | null
  onSelectFolder?: (folder: string | null) => void
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
  linksCount: _linksCount,
  activeFilter = 'All',
  onFilterChange,
  statusFilters = [],
  categories = [],
  filterLinks = [],
  theme,
  onToggleTheme,
  palette,
  onPaletteChange,
  notes: _notes = [],
  activeFolder: _activeFolder = null,
  onSelectFolder: _onSelectFolder,
  onNewClick: _onNewClick,
  onNotificationsClick: _onNotificationsClick,
  onAssistantClick: _onAssistantClick,
  onLogoClick,
  onLogout,
  hasUnread: _hasUnread = true,
  appName: _appName = 'Dashio',
}: TopNavProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  const [customAccentHex, setCustomAccentHex] = useState<string>(() => {
    return localStorage.getItem('lo-custom-accent') || '#7C5CFC'
  })
  const [customHexInput, setCustomHexInput] = useState<string>(() => {
    return (localStorage.getItem('lo-custom-accent') || '#7C5CFC').replace('#', '')
  })
  const [isCustomAccentActive, setIsCustomAccentActive] = useState<boolean>(() => {
    return localStorage.getItem('lo-palette-is-custom') === 'true'
  })

  useEffect(() => {
    if (isCustomAccentActive && customAccentHex) {
      applyCustomAccent(customAccentHex)
    }
  }, [theme, isCustomAccentActive, customAccentHex])

  function hexLuminance(hex: string): number {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.slice(0, 2), 16) / 255
    const g = parseInt(clean.slice(2, 4), 16) / 255
    const b = parseInt(clean.slice(4, 6), 16) / 255
    const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  }

  function applyCustomAccent(hex: string) {
    const cleanHex = hex.startsWith('#') ? hex : `#${hex}`
    setCustomAccentHex(cleanHex)
    setCustomHexInput(cleanHex.replace('#', ''))
    setIsCustomAccentActive(true)
    localStorage.setItem('lo-custom-accent', cleanHex)
    localStorage.setItem('lo-palette-is-custom', 'true')

    // Determine contrast text color based on luminance
    const luminance = hexLuminance(cleanHex)
    const isLight = luminance > 0.35
    const contrastText = isLight ? '#0e0c1a' : '#ffffff'

    const root = document.documentElement
    root.style.setProperty('--accent-crimson', cleanHex)
    root.style.setProperty('--accent-light-crimson', cleanHex)
    root.style.setProperty('--accent-sky', cleanHex)
    root.style.setProperty('--chip-bg-active', cleanHex)
    root.style.setProperty('--chip-text-active', contrastText)
    root.style.setProperty('--nav-bg-active', cleanHex)
    root.style.setProperty('--chat-send-bg', cleanHex)
    root.style.setProperty('--chat-send-bg-hover', cleanHex)
    root.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${cleanHex} 0%, ${cleanHex} 100%)`)
    root.style.setProperty('--gradient-hover', `linear-gradient(135deg, ${cleanHex} 0%, ${cleanHex} 100%)`)
    root.style.setProperty('--auth-title-gradient', `linear-gradient(135deg, ${cleanHex} 0%, ${cleanHex} 100%)`)
    root.style.setProperty('--header-title-gradient', `linear-gradient(135deg, ${cleanHex} 0%, ${cleanHex} 100%)`)
    root.style.setProperty('--border-hover', cleanHex)
    root.style.setProperty('--border-glow', `${cleanHex}66`)
    root.style.setProperty('--focus-ring', `${cleanHex}66`)
    root.style.setProperty('--scrollbar-thumb-hover', `${cleanHex}88`)
    root.style.setProperty('--card-tag-bg', theme === 'light'
      ? `${cleanHex}22`
      : `color-mix(in srgb, ${cleanHex} 14%, transparent)`)
    root.style.setProperty('--card-tag-color', theme === 'light' ? cleanHex : 'var(--text-main)')
    root.style.setProperty('--sidebar-active-shadow', `0 4px 16px ${cleanHex}48`)
    root.style.setProperty('--beta-badge-bg', `${cleanHex}26`)

    // Harmonize background surfaces with accent tint
    if (theme === 'light') {
      root.style.setProperty('--color-bg', `color-mix(in srgb, ${cleanHex} 6%, #ffffff)`)
      root.style.setProperty('--bg-sidebar', `color-mix(in srgb, ${cleanHex} 12%, #ffffff)`)
      root.style.setProperty('--bg-card-hover', `color-mix(in srgb, ${cleanHex} 10%, #ffffff)`)
      root.style.setProperty('--nav-bg-hover', `color-mix(in srgb, ${cleanHex} 12%, #ffffff)`)
      root.style.setProperty('--chip-bg-hover', `color-mix(in srgb, ${cleanHex} 14%, #ffffff)`)
      root.style.setProperty('--nav-solid-bg', `color-mix(in srgb, ${cleanHex} 10%, rgba(0, 0, 0, 0.05))`)
      root.style.setProperty('--nav-solid-bg-hover', `color-mix(in srgb, ${cleanHex} 20%, rgba(0, 0, 0, 0.1))`)
      root.style.setProperty('--border', `color-mix(in srgb, ${cleanHex} 18%, transparent)`)
      root.style.setProperty('--mobile-nav-bg', `color-mix(in srgb, ${cleanHex} 6%, #ffffff)`)
      root.style.setProperty('--tab-active-bg', `color-mix(in srgb, ${cleanHex} 10%, #ffffff)`)
    } else {
      root.style.setProperty('--color-bg', `color-mix(in srgb, ${cleanHex} 10%, #0e0c1a)`)
      root.style.setProperty('--color-base', `color-mix(in srgb, ${cleanHex} 12%, #0e0c1a)`)
      root.style.setProperty('--bg-card', `color-mix(in srgb, ${cleanHex} 14%, #12101f)`)
      root.style.setProperty('--bg-card-hover', `color-mix(in srgb, ${cleanHex} 18%, #12101f)`)
      root.style.setProperty('--bg-sidebar', `color-mix(in srgb, ${cleanHex} 12%, #0e0c1a)`)
      root.style.setProperty('--border', `color-mix(in srgb, ${cleanHex} 20%, transparent)`)
      root.style.setProperty('--mobile-nav-bg', `color-mix(in srgb, ${cleanHex} 10%, #0e0c1a)`)
      root.style.setProperty('--nav-solid-bg', `color-mix(in srgb, ${cleanHex} 6%, rgba(255, 255, 255, 0.07))`)
      root.style.setProperty('--nav-solid-bg-hover', `color-mix(in srgb, ${cleanHex} 12%, rgba(255, 255, 255, 0.16))`)
      root.style.setProperty('--chip-bg-hover', `color-mix(in srgb, ${cleanHex} 14%, var(--chip-bg))`)
      root.style.setProperty('--chip-text-hover', 'var(--text-main)')
      root.style.setProperty('--chip-border-hover', `color-mix(in srgb, ${cleanHex} 24%, transparent)`)
    }
  }

  function selectPresetPalette(id: ColorPalette) {
    setIsCustomAccentActive(false)
    localStorage.setItem('lo-palette-is-custom', 'false')

    const root = document.documentElement
    const props = [
      '--accent-crimson',
      '--accent-light-crimson',
      '--accent-sky',
      '--chip-bg-active',
      '--chip-text-active',
      '--nav-bg-active',
      '--chat-send-bg',
      '--chat-send-bg-hover',
      '--gradient-accent',
      '--gradient-hover',
      '--auth-title-gradient',
      '--header-title-gradient',
      '--border-hover',
      '--border-glow',
      '--focus-ring',
      '--scrollbar-thumb-hover',
      '--card-tag-color',
      '--card-tag-bg',
      '--sidebar-active-shadow',
      '--beta-badge-bg',
      '--color-bg',
      '--color-base',
      '--bg-card',
      '--bg-card-hover',
      '--bg-sidebar',
      '--border',
      '--nav-bg-hover',
      '--chip-bg-hover',
      '--chip-text-hover',
      '--chip-border-hover',
      '--nav-solid-bg',
      '--nav-solid-bg-hover',
      '--mobile-nav-bg',
      '--tab-active-bg',
    ]
    props.forEach(p => root.style.removeProperty(p))

    onPaletteChange(id)
    setPaletteOpen(false)
  }

  const paletteRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const themeBtnRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K → focus search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (activeView !== 'library') return
        const input = searchInputRef.current
        if (!input) return
        input.focus()
        input.select()
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeView])

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
        right: Math.max(12, window.innerWidth - rect.right - 10),
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

        <div className="tab-switcher hidden sm:grid">
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
        <div className="top-nav-filters hidden md:flex">
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
              ref={searchInputRef}
              type="search"
              id="search-links-input"
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
              style={{ background: isCustomAccentActive ? customAccentHex : activePalette.swatch }}
              aria-hidden="true"
            />
          </button>
          {paletteOpen && menuPos && createPortal(
            <div
              ref={menuRef}
              className="palette-picker-popover"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <div className="palette-picker-menu-arrow" />
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
                  aria-selected={!isCustomAccentActive && palette === item.id}
                  className={`palette-picker-option${!isCustomAccentActive && palette === item.id ? ' palette-picker-option--active' : ''}`}
                  onClick={() => selectPresetPalette(item.id)}
                >
                  <span className="palette-picker-option-swatch" style={{ background: item.swatch }} aria-hidden="true" />
                  <span className="palette-picker-option-label">{item.label}</span>
                  {!isCustomAccentActive && palette === item.id && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                </button>
              ))}

              <div className="palette-picker-divider" />

              <div className="palette-picker-custom-wrap">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="hex-code-title">Hex code</span>
                  {isCustomAccentActive && <Check size={13} className="text-[#7C5CFC] stroke-[2.5]" />}
                </div>
                <div className="hex-code-input-wrap">
                  <span className="hex-code-prefix">#</span>
                  <input
                    type="text"
                    className="hex-code-input"
                    value={customHexInput}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                      setCustomHexInput(val)
                      if (val.length === 6) {
                        applyCustomAccent(`#${val}`)
                      }
                    }}
                    placeholder="7c5cfc"
                    maxLength={6}
                  />
                  <div className="hex-code-divider" />
                  <label className="hex-code-picker-btn" title="Pick custom color">
                    <Pipette size={13} />
                    <input
                      type="color"
                      value={customAccentHex.startsWith('#') && customAccentHex.length === 7 ? customAccentHex : '#7C5CFC'}
                      onChange={e => applyCustomAccent(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
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