import { useEffect, useRef } from 'react'
import { animationMarkup } from './login-animation-markup'
import { startLoginAnimation } from './login-animation-runtime'
import './login-animation.css'

export const LoginAnimation = () => {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = matchMedia('(min-width: 1024px)')
    let stop: (() => void) | undefined
    const sync = () => {
      stop?.()
      stop = undefined
      if (!desktop.matches || document.hidden) return
      stop = startLoginAnimation(root)
      if (motion.matches) { stop(); stop = undefined }
    }
    sync()
    motion.addEventListener('change', sync)
    desktop.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      stop?.()
      motion.removeEventListener('change', sync)
      desktop.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  return <div className="login-animation" ref={rootRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: animationMarkup }} />
}
