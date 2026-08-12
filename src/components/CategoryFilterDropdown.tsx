import { ChevronDown, Check } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STATUS_FILTERS } from '../lib/constants'
import { animateCategoryMenuClose, animateCategoryMenuOpen } from './react-bits/animations'

const MENU_GAP = 6
const SCROLLABLE_THRESHOLD = 7
const ITEM_HEIGHT = 36

function countForCategory(
  category: string,
  links: { status?: string; category: string }[],
) {
  return links.filter(l => l.category === category).length
}

const STATUS_SET = new Set<string>(STATUS_FILTERS)

function isCategoryFilter(filter: string) {
  return !STATUS_SET.has(filter)
}

export function CategoryFilterDropdown({
  categories,
  activeFilter,
  onSelect,
  links = [],
}: {
  categories: string[]
  activeFilter: string
  onSelect: (filter: string) => void
  links?: { status?: string; category: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)

  const activeCategory = isCategoryFilter(activeFilter) ? activeFilter : null
  const scrollable = categories.length > SCROLLABLE_THRESHOLD

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + MENU_GAP,
      left: rect.left,
      minWidth: rect.width,
    })
  }, [])

  const closeMenu = useCallback(() => {
    if (closingRef.current) return

    const menu = menuRef.current
    if (!menu || !open) {
      setOpen(false)
      setMenuPos(null)
      return
    }

    closingRef.current = true
    animateCategoryMenuClose(menu, () => {
      closingRef.current = false
      setOpen(false)
      setMenuPos(null)
    })
  }, [open])

  function openMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + MENU_GAP,
        left: rect.left,
        minWidth: rect.width,
      })
    }
    setOpen(true)
  }

  function toggleOpen() {
    if (open) {
      closeMenu()
    } else {
      openMenu()
    }
  }

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return
    animateCategoryMenuOpen(menuRef.current, triggerRef.current)
  }, [open, menuPos])

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }

    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, closeMenu, updatePosition])

  if (categories.length === 0) return null

  return (
    <div
      className={`category-filter${open ? ' category-filter--open' : ''}${activeCategory ? ' category-filter--active' : ''}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`category-filter-trigger filter-pill${activeCategory ? ' active' : ''}`}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activeCategory ? `Category: ${activeCategory}` : 'Filter by category'}
      >
        <span className="category-filter-label truncate">
          {activeCategory ?? 'Category'}
        </span>
        {activeCategory && links.length > 0 && (
          <span className="filter-pill-count">{countForCategory(activeCategory, links)}</span>
        )}
        <ChevronDown size={12} strokeWidth={2.5} className="category-filter-chevron" aria-hidden="true" />
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          className="category-filter-popover"
          style={{ top: menuPos.top, left: menuPos.left, minWidth: menuPos.minWidth }}
        >
          <div
            className={`category-filter-menu${scrollable ? ' category-filter-menu--scrollable' : ''}`}
            role="listbox"
            aria-label="Categories"
            style={scrollable ? { maxHeight: SCROLLABLE_THRESHOLD * ITEM_HEIGHT + 16 } : undefined}
          >
            {categories.map(cat => {
              const count = countForCategory(cat, links)
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`category-filter-option${isActive ? ' category-filter-option--active' : ''}`}
                  onClick={() => {
                    onSelect(cat)
                    closeMenu()
                  }}
                >
                  <span className="category-filter-option-label truncate">{cat}</span>
                  <span className="category-filter-option-meta">
                    <span className="filter-pill-count">{count}</span>
                    {isActive && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
