import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import gsap from 'gsap'
import './CardSwap.css'

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  customClass?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { customClass, className = '', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={`card ${customClass ?? ''} ${className}`.trim()}
    />
  )
})

type EasingMode = 'linear' | 'elastic'

export type CardSwapProps = {
  width?: number | string
  height?: number | string
  cardDistance?: number
  verticalDistance?: number
  delay?: number
  pauseOnHover?: boolean
  onCardClick?: (idx: number) => void
  skewAmount?: number
  easing?: EasingMode
  className?: string
  children: ReactNode
}

type Slot = {
  x: number
  y: number
  z: number
  zIndex: number
}

const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
})

function placeNow(el: HTMLElement, slot: Slot, skew: number) {
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  })
}

export default function CardSwap({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 6,
  easing = 'elastic',
  className = '',
  children,
}: CardSwapProps) {
  const childArr = useMemo(() => Children.toArray(children), [children])
  const refs = useMemo(
    () => childArr.map(() => ({ current: null as HTMLDivElement | null })),
    [childArr.length],
  )

  const order = useRef(Array.from({ length: childArr.length }, (_, i) => i))
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const intervalRef = useRef<number | undefined>(undefined)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const animConfig =
      easing === 'elastic'
        ? {
            ease: 'elastic.out(0.6,0.9)',
            durDrop: 2,
            durMove: 2,
            durReturn: 2,
            promoteOverlap: 0.9,
            returnDelay: 0.05,
          }
        : {
            ease: 'power1.inOut',
            durDrop: 0.8,
            durMove: 0.8,
            durReturn: 0.8,
            promoteOverlap: 0.45,
            returnDelay: 0.2,
          }

    const total = refs.length
    refs.forEach((r, i) => {
      if (r.current) placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount)
    })

    const swap = () => {
      if (order.current.length < 2) return

      const [front, ...rest] = order.current
      const elFront = refs[front]?.current
      if (!elFront) return

      const tl = gsap.timeline()
      tlRef.current = tl

      tl.to(elFront, {
        y: '+=500',
        duration: animConfig.durDrop,
        ease: animConfig.ease,
      })

      tl.addLabel('promote', `-=${animConfig.durDrop * animConfig.promoteOverlap}`)
      rest.forEach((idx, i) => {
        const el = refs[idx]?.current
        if (!el) return
        const slot = makeSlot(i, cardDistance, verticalDistance, refs.length)
        tl.set(el, { zIndex: slot.zIndex }, 'promote')
        tl.to(
          el,
          {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            duration: animConfig.durMove,
            ease: animConfig.ease,
          },
          `promote+=${i * 0.15}`,
        )
      })

      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length)
      tl.addLabel('return', `promote+=${animConfig.durMove * animConfig.returnDelay}`)
      tl.call(() => {
        gsap.set(elFront, { zIndex: backSlot.zIndex })
      }, undefined, 'return')
      tl.to(
        elFront,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: animConfig.durReturn,
          ease: animConfig.ease,
        },
        'return',
      )

      tl.call(() => {
        order.current = [...rest, front]
      })
    }

    swap()
    intervalRef.current = window.setInterval(swap, delay)

    if (pauseOnHover && container.current) {
      const node = container.current
      const pause = () => {
        tlRef.current?.pause()
        if (intervalRef.current) window.clearInterval(intervalRef.current)
      }
      const resume = () => {
        tlRef.current?.play()
        intervalRef.current = window.setInterval(swap, delay)
      }
      node.addEventListener('mouseenter', pause)
      node.addEventListener('mouseleave', resume)
      return () => {
        node.removeEventListener('mouseenter', pause)
        node.removeEventListener('mouseleave', resume)
        if (intervalRef.current) window.clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, childArr.length])

  const rendered = childArr.map((child, i) => {
    if (!isValidElement(child)) return child

    const element = child as ReactElement<{ style?: CSSProperties; onClick?: (e: React.MouseEvent) => void; ref?: Ref<HTMLDivElement> }>
    const mergedStyle: CSSProperties = {
      width,
      height,
      ...(element.props.style ?? {}),
    }

    return cloneElement(element, {
      key: i,
      ref: refs[i] as Ref<HTMLDivElement>,
      style: mergedStyle,
      onClick: (e: React.MouseEvent) => {
        element.props.onClick?.(e)
        onCardClick?.(i)
      },
    })
  })

  return (
    <div
      ref={container}
      className={`card-swap-container ${className}`.trim()}
      style={{ width, height }}
    >
      {rendered}
    </div>
  )
}
