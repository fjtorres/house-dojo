import { useRef } from 'react'

// Answers can come back out of order (a slow load finishing after a newer one): only the newest
// request's answer is applied. See https://react.dev/learn/you-might-not-need-an-effect#fetching-data
export function useLatest() {
  const seq = useRef(0)
  return async <T>(request: PromiseLike<T>, apply: (value: T) => void) => {
    const n = ++seq.current
    const value = await request
    if (n === seq.current) apply(value)
  }
}
