import { useCallback, useEffect, useRef, useState } from 'react'

/** Duración del resaltado de una fila recién agregada o modificada (ms). */
export const FLASH_MS = 600

/**
 * Marca una key (id de fila) como "resaltada" durante 600 ms y después la limpia.
 * Devuelve `[keyResaltada, flash]`. El timer se cancela al desmontar.
 */
export function useFlash<K>(): [K | null, (k: K) => void] {
  const [key, setKey] = useState<K | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const flash = useCallback((k: K) => {
    if (timer.current) clearTimeout(timer.current)
    setKey(k)
    timer.current = setTimeout(() => setKey(null), FLASH_MS)
  }, [])

  return [key, flash]
}
