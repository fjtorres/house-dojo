import { useSyncExternalStore } from 'react'
import { es, type Messages } from './es'
import { en } from './en'

// To add a language: copy en.tsx, translate it (TypeScript flags any missing key) and list it here.
export const languages = {
  es: { name: 'Español', messages: es },
  en: { name: 'English', messages: en },
} satisfies Record<string, { name: string; messages: Messages }>
export type Lang = keyof typeof languages

const KEY = 'lang'
const isLang = (l: unknown): l is Lang => typeof l === 'string' && Object.hasOwn(languages, l)

// The saved choice, else the browser's first language we have, else Spanish.
function initial(): Lang {
  let saved: string | null = null
  try { saved = localStorage.getItem(KEY) } catch { /* storage blocked: fall back to the browser */ }
  if (isLang(saved)) return saved
  return navigator.languages.map((l) => l.slice(0, 2)).find(isLang) ?? 'es'
}

let lang = initial()
document.documentElement.lang = lang
const listeners = new Set<() => void>()

export function setLang(l: Lang) {
  lang = l
  document.documentElement.lang = l
  try { localStorage.setItem(KEY, l) } catch { /* not remembered, still switched */ }
  listeners.forEach((f) => f())
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
export const useLang = () => useSyncExternalStore(subscribe, () => lang)
export const useT = () => languages[useLang()].messages
// for code outside components (error texts shown from event handlers)
export const messages = () => languages[lang].messages
