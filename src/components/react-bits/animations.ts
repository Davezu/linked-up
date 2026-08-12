import gsap from 'gsap'

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Stagger-reveal palette menu (React Bits–style chain) */
export function animatePaletteMenuOpen(
  menuEl: HTMLElement,
  triggerEl: HTMLElement | null,
) {
  if (prefersReducedMotion()) return

  const items = menuEl.querySelectorAll<HTMLElement>('.palette-picker-option')

  gsap.fromTo(
    menuEl,
    { opacity: 0, scale: 0.96, y: -6, transformOrigin: 'top right' },
    { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power3.out' },
  )

  gsap.fromTo(
    items,
    { opacity: 0, x: 14, scale: 0.96 },
    {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.38,
      stagger: 0.055,
      ease: 'power3.out',
      delay: 0.04,
    },
  )

  if (triggerEl) {
    gsap.fromTo(
      triggerEl,
      { scale: 1 },
      { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.inOut' },
    )
  }
}

export function animatePaletteMenuClose(menuEl: HTMLElement) {
  if (prefersReducedMotion()) return

  gsap.to(menuEl, {
    opacity: 0,
    scale: 0.92,
    y: -6,
    duration: 0.18,
    ease: 'power2.in',
  })
}

/** Stagger-reveal category filter dropdown */
export function animateCategoryMenuOpen(
  menuEl: HTMLElement,
  triggerEl: HTMLElement | null,
) {
  if (prefersReducedMotion()) return

  const items = menuEl.querySelectorAll<HTMLElement>('.category-filter-option')

  gsap.fromTo(
    menuEl,
    { opacity: 0, scale: 0.96, y: -6, transformOrigin: 'top left' },
    { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power3.out' },
  )

  gsap.fromTo(
    items,
    { opacity: 0, x: -12, scale: 0.97 },
    {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.34,
      stagger: 0.045,
      ease: 'power3.out',
      delay: 0.03,
    },
  )

  if (triggerEl) {
    gsap.fromTo(
      triggerEl,
      { scale: 1 },
      { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.inOut' },
    )
  }
}

export function animateCategoryMenuClose(
  menuEl: HTMLElement,
  onComplete?: () => void,
) {
  if (prefersReducedMotion()) {
    onComplete?.()
    return
  }

  const items = menuEl.querySelectorAll<HTMLElement>('.category-filter-option')

  gsap.to(items, {
    opacity: 0,
    x: -8,
    duration: 0.12,
    stagger: { each: 0.02, from: 'end' },
    ease: 'power2.in',
  })

  gsap.to(menuEl, {
    opacity: 0,
    scale: 0.94,
    y: -4,
    duration: 0.18,
    ease: 'power2.in',
    delay: 0.04,
    onComplete,
  })
}

/** Sticker landing animation for a new note */
export function animateNoteDrop(el: HTMLElement) {
  if (prefersReducedMotion()) return

  const rotMatch = /rotate\(([-\d.]+)deg\)/.exec(el.style.transform)
  const rotation = rotMatch ? parseFloat(rotMatch[1]) : 0

  gsap.fromTo(
    el,
    { scale: 0.5, y: -60, opacity: 0, rotation, transformOrigin: '50% 80%' },
    { scale: 1, y: 0, opacity: 1, rotation, duration: 0.65, ease: 'back.out(1.5)' },
  )
}

export { prefersReducedMotion }

/** Spectacular Button — shine sweep on hover */
export function animateSpectacularHover(shineEl: HTMLElement) {
  gsap.killTweensOf(shineEl)
  gsap.fromTo(
    shineEl,
    { x: '-130%', opacity: 0 },
    {
      x: '130%',
      opacity: 1,
      duration: 0.55,
      ease: 'power2.out',
      onComplete: () => {
        gsap.set(shineEl, { opacity: 0, x: '-130%' })
      },
    },
  )
}

/** Spectacular Button — click punch + spark burst */
export function animateSpectacularClick(
  innerEl: HTMLElement,
  sparkEl: HTMLElement,
  clientX: number,
  clientY: number,
) {
  gsap.killTweensOf(innerEl)
  gsap.fromTo(
    innerEl,
    { scale: 1 },
    { scale: 0.94, duration: 0.08, ease: 'power2.in', yoyo: true, repeat: 1 },
  )

  const rect = sparkEl.getBoundingClientRect()
  const originX = clientX - rect.left
  const originY = clientY - rect.top
  const dots = 6

  for (let i = 0; i < dots; i++) {
    const dot = document.createElement('span')
    dot.className = 'spectacular-btn-spark-dot'
    dot.style.left = `${originX}px`
    dot.style.top = `${originY}px`
    sparkEl.appendChild(dot)

    const angle = (Math.PI * 2 * i) / dots + Math.random() * 0.4
    const distance = 10 + Math.random() * 14

    gsap.fromTo(
      dot,
      { opacity: 0.9, scale: 0.4, x: 0, y: 0 },
      {
        opacity: 0,
        scale: 0,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        duration: 0.45,
        ease: 'power3.out',
        onComplete: () => dot.remove(),
      },
    )
  }
}

/** Sliding thumb for spectacular filter group */
export function animateSpectacularFilterThumb(
  thumbEl: HTMLElement,
  left: number,
  width: number,
) {
  if (prefersReducedMotion()) {
    gsap.set(thumbEl, { left, width })
    return
  }

  gsap.to(thumbEl, {
    left,
    width,
    duration: 0.38,
    ease: 'power3.out',
  })
}
