import { useEffect, useState } from 'react'
import { Logo } from './Logo'

const DURATION_MS = 2000
const WORD = 'kangourou'

/** Opening animation: the logo hops in, the wordmark follows, then the overlay fades away. */
export function Splash() {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setDone(true), reduced ? 400 : DURATION_MS)
    return () => clearTimeout(t)
  }, [])
  if (done) return null
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-glow" />
      <div className="splash-stage">
        <div className="splash-hop">
          <Logo size={88} />
        </div>
        <div className="splash-shadow" />
        <div className="splash-word">
          {[...WORD].map((ch, i) => (
            <span key={i} style={{ animationDelay: `${780 + i * 40}ms` }}>{ch}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
