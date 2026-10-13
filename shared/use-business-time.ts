import { useEffect, useState } from 'react'

export function useBusinessTime(evaluatedAt?: string) {
  const [sample, setSample] = useState(() => ({ source: evaluatedAt, started: performance.now(), tick: performance.now(), wall: Date.now() }))
  useEffect(() => {
    const started = performance.now()
    const update = () => setSample({ source: evaluatedAt, started, tick: performance.now(), wall: Date.now() })
    const first = setTimeout(update, 0)
    const timer = setInterval(update, 15000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [evaluatedAt])
  const elapsed = sample.source === evaluatedAt ? sample.tick - sample.started : 0
  return new Date(evaluatedAt ? Date.parse(evaluatedAt) + elapsed : sample.wall)
}
