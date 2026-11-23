import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from './i18n'

type Props = { label: string; children: ReactNode }

// On a phone, a row to swipe (native scroll + snap) or move with the arrows; on a wide screen, a grid (see index.css).
// The arrows show only when something doesn't fit, so the grid never gets them.
export function Carousel({ label, children }: Props) {
  const t = useT()
  const track = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  // where the arrows are taking the row: a quick second tap moves on from there, not from mid-animation
  const target = useRef<number | null>(null)

  useEffect(() => {
    const t = track.current!
    const update = () => {
      if (target.current !== null && Math.abs(t.scrollLeft - target.current) < 1) target.current = null
      setCanPrev(t.scrollLeft > 1)
      setCanNext(t.scrollLeft + t.clientWidth < t.scrollWidth - 1)
    }
    update()
    t.addEventListener('scroll', update, { passive: true })
    // a swipe can interrupt an arrow's scroll before it gets there
    const settled = () => { target.current = null }
    t.addEventListener('scrollend', settled)
    // the track resizes with the window; its content changes when a child is added or removed
    const resize = new ResizeObserver(update)
    resize.observe(t)
    const content = new MutationObserver(update)
    content.observe(t, { childList: true })
    return () => { t.removeEventListener('scroll', update); t.removeEventListener('scrollend', settled); resize.disconnect(); content.disconnect() }
  }, [])

  // one card per click: scroll to the next card's snap position, never by a width that could skip one
  const scroll = (dir: 1 | -1) => {
    const t = track.current!
    const origin = t.getBoundingClientRect().left - t.scrollLeft + (parseFloat(getComputedStyle(t).scrollPaddingLeft) || 0)
    const stops = [...t.children].map((c) => c.getBoundingClientRect().left - origin)
    const from = target.current ?? t.scrollLeft
    const stop = dir > 0 ? stops.find((x) => x > from + 1) : stops.findLast((x) => x < from - 1)
    if (stop === undefined) return
    // the last cards can't reach the left edge: the row stops at its end
    const left = Math.min(stop, t.scrollWidth - t.clientWidth)
    target.current = left
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    t.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
  }
  const arrows = canPrev || canNext

  return (
    <div className="carousel" role="group" aria-roledescription={t.carousel.role} aria-label={label}>
      {arrows && <button className="carousel-arrow prev" aria-label={t.carousel.prev} disabled={!canPrev} onClick={() => scroll(-1)}>‹</button>}
      <div className="carousel-track" ref={track}>{children}</div>
      {arrows && <button className="carousel-arrow next" aria-label={t.carousel.next} disabled={!canNext} onClick={() => scroll(1)}>›</button>}
    </div>
  )
}
