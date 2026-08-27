import { memo, useState } from 'react'
import { Bookmark, FileText, Sparkles } from 'lucide-react'
import CardSwap, { Card } from './react-bits/CardSwap'

const SHOWCASE_CARDS = [
  {
    title: 'Save Links',
    icon: Bookmark,
    media: { type: 'image' as const, src: '/resources/img1.png', alt: 'Saved links library preview' },
  },
  {
    title: 'Take Notes',
    icon: FileText,
    media: { type: 'image' as const, src: '/resources/img2.png', alt: 'Notes canvas preview' },
  },
  {
    title: 'Ask AI',
    icon: Sparkles,
    media: { type: 'video' as const, src: '/resources/ai-vid.mp4', alt: 'AI chat preview' },
  },
]

export const AuthShowcase = memo(function AuthShowcase() {
  const [videoError, setVideoError] = useState(false)

  return (
    <aside className="auth-showcase" aria-hidden="true">
      <div className="auth-showcase-stage">
        <CardSwap
          className="card-swap-container--auth"
          width={800}
          height={530}
          cardDistance={60}
          verticalDistance={70}
          delay={4500}
          pauseOnHover
          skewAmount={6}
        >
          {SHOWCASE_CARDS.map(({ title, icon: Icon, media }) => (
            <Card key={title} className="auth-swap-card">
              <div className="auth-swap-card-header">
                <Icon size={13} strokeWidth={2} aria-hidden="true" className="text-white/80" />
                <span className="text-[14px] font-medium text-white/90">{title}</span>
              </div>
              <div className="auth-swap-card-media">
                {media.type === 'image' || (media.type === 'video' && videoError) ? (
                  <img
                    src={media.type === 'image' ? media.src : '/resources/img2.png'}
                    alt={media.alt}
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <video
                    src={media.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={media.alt}
                    onError={() => setVideoError(true)}
                  />
                )}
              </div>
            </Card>
          ))}
        </CardSwap>
      </div>
    </aside>
  )
})
