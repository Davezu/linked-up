import { useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import type { LinkRecord } from '../types'
import { getDomain, getFaviconUrl, getRelated, formatCarouselBadge } from '../lib/helpers'

export function LinkCarouselCard({
  link,
  allLinks,
  onDelete,
  onStatusChange,
  isActive,
  slideOffset,
}: {
  link: LinkRecord
  allLinks: LinkRecord[]
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  isActive: boolean
  slideOffset: number
}) {
  const domain = getDomain(link.url)
  const favicon = getFaviconUrl(link.url)
  const related = getRelated(link, allLinks)
  const [showRelated, setShowRelated] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const previewImage = link.image && !imageFailed ? link.image : null

  const slideClass =
    slideOffset < 0 ? 'is-before' : slideOffset > 0 ? 'is-after' : isActive ? 'is-active' : ''

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onDelete(link.id)
  }

  return (
    <article
      className={`link-card link-card--carousel ${link.isNew ? 'card-new' : ''} ${slideClass}`}
      data-carousel-card
      data-link-id={link.id}
      aria-hidden={!isActive && Math.abs(slideOffset) > 1}
    >
      <div className="carousel-card-media">
        {previewImage ? (
          <img
            src={previewImage}
            alt=""
            className="carousel-card-preview"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="carousel-card-preview carousel-card-preview--placeholder" aria-hidden="true">
            {favicon ? (
              <img src={favicon} alt="" className="carousel-card-preview-fallback-icon" loading="lazy" />
            ) : (
              <span className="carousel-card-preview-fallback-text">{domain}</span>
            )}
          </div>
        )}
        <div className="carousel-card-badges">
          <span className="carousel-badge carousel-badge--primary">
            ({formatCarouselBadge(link.category)})
          </span>
          {link.tags.slice(0, 2).map(tag => (
            <span key={tag} className="carousel-badge carousel-badge--outline">
              {formatCarouselBadge(tag)}
            </span>
          ))}
        </div>
      </div>

      <div className="carousel-card-body">
        <div className="carousel-card-head">
          <div className="carousel-card-icon-wrap">
            {favicon ? (
              <img src={favicon} alt="" className="carousel-card-icon" loading="lazy" />
            ) : (
              <span className="carousel-card-icon-fallback" aria-hidden="true">↗</span>
            )}
          </div>
          <h3 className="carousel-card-title">{link.title || link.url}</h3>
        </div>

        {link.summary && <p className="carousel-card-desc">{link.summary}</p>}

        <div className="carousel-card-footer">
          <div className="carousel-card-status" role="group" aria-label="Link status">
            {(['To Watch', 'Finished', 'Favorite'] as const).map(s => {
              const isStatusActive = link.status === s || (!link.status && s === 'To Watch')
              const label = s === 'To Watch' ? 'Watch' : s === 'Finished' ? 'Done' : 'Fav'
              return (
                <button
                  key={s}
                  type="button"
                  className={`carousel-status-btn ${isStatusActive ? 'active' : ''}`}
                  onClick={() => onStatusChange(link.id, s)}
                  aria-pressed={isStatusActive}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="carousel-open-btn"
          >
            Open
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>

        {related.length > 0 && (
          <button
            type="button"
            className="carousel-related-toggle"
            onClick={() => setShowRelated(v => !v)}
          >
            {showRelated ? 'Hide related' : `${related.length} related`}
          </button>
        )}

        {showRelated && related.length > 0 && (
          <div className="carousel-related-list">
            {related.map(r => (
              <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="carousel-related-item">
                {r.title}
              </a>
            ))}
          </div>
        )}

        <span className="carousel-card-domain">{domain}</span>
      </div>

      <button
        type="button"
        className="card-delete card-delete--carousel"
        onClick={handleDeleteClick}
        aria-label={`Remove ${link.title || link.url}`}
        title="Remove link"
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </article>
  )
}
