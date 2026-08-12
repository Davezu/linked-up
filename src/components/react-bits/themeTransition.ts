import gsap from 'gsap'
import './ThemeMorph.css'

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

/** Toggle animation — theme applies instantly; content never covered or removed */
export function runThemeToggleAnimation(
  originEl: HTMLElement | null,
  applyTheme: () => void,
): void {
  if (prefersReducedMotion()) {
    applyTheme()
    return
  }

  const pulseButton = () => {
    if (!originEl) return
    gsap.fromTo(
      originEl,
      { scale: 0.86 },
      { scale: 1, duration: 0.38, ease: 'back.out(2.2)' },
    )
    const icon = originEl.querySelector('svg')
    if (icon) {
      gsap.fromTo(
        icon,
        { rotate: -70, opacity: 0, scale: 0.45 },
        { rotate: 0, opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(2)' },
      )
    }
  }

  const doc = document as DocumentWithViewTransition

  if (doc.startViewTransition) {
    doc.startViewTransition(() => {
      applyTheme()
    }).finished.then(pulseButton).catch(pulseButton)
    return
  }

  document.documentElement.classList.add('theme-morphing')
  applyTheme()
  pulseButton()
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-morphing')
  }, 480)
}
