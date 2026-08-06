import { useRef, useEffect } from 'react'
import type { LinkRecord } from '../types'
import { getDomain } from '../lib/helpers'

export function DeleteConfirmDialog({
  link,
  onCancel,
  onConfirm,
}: {
  link: LinkRecord
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onCancel])

  const title = link.title?.trim() || getDomain(link.url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--dialog-overlay-bg)] backdrop-blur-sm delete-dialog-overlay"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[380px] p-4 bg-[var(--color-base)] border border-[var(--border-hover)] rounded-[var(--radius-lg)] shadow-[var(--dialog-shadow)] delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="delete-dialog-title" className="m-0 mb-2 text-[17px] font-semibold text-[var(--text-main)] tracking-tight">
          Delete this link?
        </h2>
        <p id="delete-dialog-desc" className="m-0 mb-4 text-[14px] leading-relaxed text-[var(--text-dim)]">
          <span className="font-medium text-[var(--text-main)]">{title}</span>
          {' '}will be removed from your library. This can’t be undone.
        </p>
        <div className="flex flex-row-reverse gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="flex-1 min-h-[44px] px-3 py-2.5 rounded-[var(--radius-md)] text-[14px] font-semibold cursor-pointer border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-hover)] transition-all"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 min-h-[44px] px-3 py-2.5 rounded-[var(--radius-md)] text-[14px] font-semibold cursor-pointer bg-[var(--color-destructive)] text-white hover:bg-red-600 transition-all"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
