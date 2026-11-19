import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  addEventListener('hashchange', onChange)
  return () => removeEventListener('hashchange', onChange)
}

// Hash routes (#/parents/items): GitHub Pages only serves index.html, so path routes would 404 on reload.
export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export const go = (href: string) => { location.hash = href }
