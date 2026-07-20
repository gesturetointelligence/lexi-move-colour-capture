import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * useState persisted to localStorage under `key`.
 * - JSON parse/stringify are wrapped in try/catch (quota, private mode, bad data).
 * - `validate` inspects the parsed value and returns a valid T or null to
 *   fall back to `initial` (used for versioned shapes).
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
  validate?: (raw: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw == null) return initial
      const parsed = JSON.parse(raw) as unknown
      if (validate) return validate(parsed) ?? initial
      return parsed as T
    } catch {
      return initial
    }
  })

  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or unavailable — state stays in memory.
    }
  }, [key, value])

  return [value, setValue]
}
