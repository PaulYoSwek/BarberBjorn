import { useEffect } from 'react'

type Props = { onDone: () => void }

export function Splash({ onDone }: Props) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduce) onDone()
  }, [reduce, onDone])

  if (reduce) return null

  return (
    <div className="splash">
      <div
        className="splash-curtain"
        onAnimationEnd={(event) => {
          if (event.animationName === 'splash-wipe') onDone()
        }}
      />
      <div className="splash-lockup">
        <picture>
          <source srcSet="/logo-wordmark-small.webp?v=5" type="image/webp" />
          <img className="splash-mark" src="/logo-wordmark-small.png?v=5" alt="Bjorn’s Barber" width="640" height="607" />
        </picture>
        <div className="splash-meet" />
      </div>
    </div>
  )
}
