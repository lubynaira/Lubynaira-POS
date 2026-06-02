import { useState, useEffect } from 'react'

/**
 * Returns true when viewport width is less than `breakpoint` px.
 * Default breakpoint = 768 (Tailwind `md`).
 *
 * Reactive — updates when the viewport crosses the threshold (e.g. orientation change).
 */
export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e) => setIsMobile(e.matches)
    // Sync initial state in case SSR mismatch
    setIsMobile(mq.matches)
    // Modern listener (Safari 14+, all others)
    if (mq.addEventListener) {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    // Legacy fallback for older Safari
    mq.addListener(handler)
    return () => mq.removeListener(handler)
  }, [breakpoint])

  return isMobile
}
