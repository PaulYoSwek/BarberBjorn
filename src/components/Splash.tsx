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
        <img className="splash-mark" src="/logo-wordmark.png?v=2" alt="BarberBjorn" />
        <div className="splash-meet" />
      </div>
    </div>
  )
}
