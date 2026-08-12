import { forwardRef, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './SpectacularButton.css'
import {
  animateSpectacularClick,
  animateSpectacularHover,
  prefersReducedMotion,
} from './animations'

export interface SpectacularButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children: ReactNode
}

export const SpectacularButton = forwardRef<HTMLButtonElement, SpectacularButtonProps>(
  function SpectacularButton(
    { active = false, children, className = '', onClick, onMouseEnter, onMouseLeave, ...rest },
    ref,
  ) {
    const shineRef = useRef<HTMLSpanElement>(null)
    const innerRef = useRef<HTMLSpanElement>(null)
    const sparkRef = useRef<HTMLSpanElement>(null)

    function handleMouseEnter(e: React.MouseEvent<HTMLButtonElement>) {
      if (shineRef.current && !prefersReducedMotion()) {
        animateSpectacularHover(shineRef.current)
      }
      onMouseEnter?.(e)
    }

    function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
      if (innerRef.current && sparkRef.current && !prefersReducedMotion()) {
        animateSpectacularClick(innerRef.current, sparkRef.current, e.clientX, e.clientY)
      }
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        className={`spectacular-btn${active ? ' spectacular-btn--active' : ''}${className ? ` ${className}` : ''}`}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        {...rest}
      >
        <span ref={innerRef} className="spectacular-btn-inner">
          <span ref={shineRef} className="spectacular-btn-shine" aria-hidden="true" />
          <span ref={sparkRef} className="spectacular-btn-spark" aria-hidden="true" />
          {children}
        </span>
      </button>
    )
  },
)
