import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import type { LinkRecord } from '../types'
import { getDomain, getFaviconUrl, getRelated } from '../lib/helpers'
import { SpectacularButton } from './react-bits/SpectacularButton'

export function LinkCard({
  link, allLinks, onDelete, onStatusChange
}: {
  link: LinkRecord
  allLinks: LinkRecord[]
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [showRelated, setShowRelated] = useState(false)
  const domain = getDomain(link.url)
  const favicon = getFaviconUrl(link.url)
  const related = getRelated(link, allLinks)
  const isProcessing = link.processing === true
  const cardBlurb = (link.summary || link.description || '').trim()

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    onDelete(link.id)
  }

  return (
    <div className={`relative flex flex-col rounded-[var(--radius-lg)] bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden shadow-lg transition-all duration-300 hover:shadow-2xl hover:border-[var(--border-hover)] link-card ${link.isNew ? 'card-new' : ''} ${isProcessing ? 'card-processing' : ''}`}>
      <a
        href={isProcessing ? undefined : link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col text-inherit card-link-area"
        aria-label={isProcessing ? 'Processing link…' : `Open ${link.title || link.url}`}
        onClick={isProcessing ? (e) => e.preventDefault() : undefined}
        style={isProcessing ? { cursor: 'default' } : undefined}
      >
        {isProcessing ? (
          <div className="w-full h-48 sm:h-52 bg-[var(--card-image-placeholder-bg)] flex items-center justify-center card-image-placeholder card-skeleton-image" aria-hidden="true">
            <Loader2 size={28} className="animate-spin text-[var(--text-muted)] skeleton-spinner" aria-hidden="true" />
          </div>
        ) : link.image ? (
          <img src={link.image} alt="" className="w-full h-48 sm:h-52 object-cover card-image" loading="lazy" decoding="async" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-48 sm:h-52 bg-[var(--card-image-placeholder-bg)] flex items-center justify-center card-image-placeholder" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, opacity: 0.3 }}>
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </div>
        )}
        <div className="p-4 flex flex-col gap-2.5 card-body">
          <div className={`font-semibold text-sm text-[var(--text-main)] line-clamp-2 leading-snug card-title ${isProcessing ? 'skeleton-text' : ''}`}>{link.title || link.url}</div>
          {isProcessing ? (
            <div className="text-xs text-[var(--text-dim)] line-clamp-3 leading-relaxed card-summary skeleton-text">{link.description}</div>
          ) : (
            cardBlurb ? (
              <div className="text-xs text-[var(--text-dim)] line-clamp-3 leading-relaxed card-summary">{cardBlurb}</div>
            ) : null
          )}

          {isProcessing ? (
            <div className="flex flex-wrap gap-1.5 mt-1 card-tags">
              <span className="h-4 w-12 rounded-full bg-[var(--badge-bg)] card-tag skeleton-pill" />
              <span className="h-4 w-16 rounded-full bg-[var(--badge-bg)] card-tag skeleton-pill" />
              <span className="h-4 w-10 rounded-full bg-[var(--badge-bg)] card-tag skeleton-pill" />
            </div>
          ) : link.tags && link.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1 card-tags">
              {link.tags.map(tag => (
                <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--card-tag-bg)] text-[var(--card-tag-color)] card-tag">#{tag}</span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between flex-shrink-0 card-footer">
            <div className="text-[11px] font-medium text-[var(--text-dim)] flex items-center gap-1.5 tracking-wide card-domain">
              {favicon && <img src={favicon} alt="" className="w-3.5 h-3.5 rounded card-favicon" />}
              {domain}
            </div>
            {!isProcessing && <span className="text-xs text-[var(--text-muted)] card-arrow" aria-hidden="true">↗</span>}
          </div>
        </div>
      </a>

      {/* Status Actions */}
      <div className="flex gap-1 p-3 pt-2.5 flex-shrink-0 card-status-actions" role="group" aria-label="Link status" onClick={e => { e.preventDefault(); e.stopPropagation() }}>
        {(['To Watch', 'Finished', 'Favorite'] as const).map(s => {
          const isActive = link.status === s || (!link.status && s === 'To Watch')
          const label = s === 'To Watch' ? 'Watch' : s === 'Finished' ? 'Done' : 'Fav'
          return (
            <SpectacularButton
              key={s}
              active={isActive}
              className="card-status-btn"
              onClick={() => onStatusChange(link.id, s)}
              aria-pressed={isActive}
              title={`Mark as ${s}`}
              disabled={isProcessing}
            >
              {label}
            </SpectacularButton>
          )
        })}
      </div>



      {!isProcessing && (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--card-delete-bg)] border border-[var(--border-hover)] text-[var(--text-dim)] hover:bg-[var(--color-destructive)] hover:text-white hover:border-[var(--color-destructive)] backdrop-blur-md transition-all z-10 card-delete"
          onClick={handleDeleteClick}
          aria-label={`Remove ${link.title || link.url}`}
          title="Remove link"
        >
          <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
