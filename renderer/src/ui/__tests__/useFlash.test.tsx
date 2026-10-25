import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlash } from '../useFlash'

describe('useFlash', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('setea la key y la limpia a los 600 ms', () => {
    const { result } = renderHook(() => useFlash<number>())
    expect(result.current[0]).toBeNull()
    act(() => result.current[1](7))
    expect(result.current[0]).toBe(7)
    act(() => {
      vi.advanceTimersByTime(599)
    })
    expect(result.current[0]).toBe(7)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current[0]).toBeNull()
  })

  it('un segundo flash reinicia el timer', () => {
    const { result } = renderHook(() => useFlash<number>())
    act(() => result.current[1](1))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    act(() => result.current[1](2))
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current[0]).toBe(2)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current[0]).toBeNull()
  })

  it('limpia el timer al desmontar', () => {
    const { result, unmount } = renderHook(() => useFlash<number>())
    act(() => result.current[1](1))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
