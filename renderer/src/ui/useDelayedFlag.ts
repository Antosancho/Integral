import { useEffect, useState } from 'react'

/**
 * Devuelve `true` solo si `active` sigue en `true` pasados `delayMs`.
 * Sirve para no mostrar un skeleton que parpadea cuando la carga es instantánea.
 */
export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    if (!active) {
      setElapsed(false)
      return
    }
    const t = setTimeout(() => setElapsed(true), delayMs)
    return () => clearTimeout(t)
  }, [active, delayMs])

  return active && elapsed
}
