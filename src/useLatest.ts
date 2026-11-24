import { useRef } from 'react'

// Answers can come back out of order (a slow load finishing after a newer one): only the newest
// request's answer is applied. See https://react.dev/learn/you-might-not-need-an-effect#fetching-data
// The returned promise settles once the newest answer is in, so an action awaiting it never sees stale data.
export function useLatest() {
  const seq = useRef(0)
  const newest = useRef<Promise<void>>(Promise.resolve())
  return <T>(request: PromiseLike<T>, apply: (value: T) => void) => {
    const n = ++seq.current
    const done: Promise<void> = Promise.resolve(request).then((value) => {
      if (n === seq.current) apply(value)
      else return newest.current
    })
    newest.current = done
    return done
  }
}
