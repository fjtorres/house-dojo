import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = { label: string; children: ReactNode }

// On a phone, a row to swipe (native scroll + snap) or move with the arrows; on a wide screen, a grid (see index.css).
// The arrows show only when something doesn't fit, so the grid never gets them.
export function Carousel({ label, children }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    const t = track.current!
    const update = () => {
      setCanPrev(t.scrollLeft > 1)
      setCanNext(t.scrollLeft + t.clientWidth < t.scrollWidth - 1)
    }
    update()
    t.addEventListener('scroll', update, { passive: true })
    // the track resizes with the window; its content changes when a child is added or removed
    const resize = new ResizeObserver(update)
    resize.observe(t)
    const content = new MutationObserver(update)
    content.observe(t, { childList: true })
    return () => { t.removeEventListener('scroll', update); resize.disconnect(); content.disconnect() }
  }, [])

  const scroll = (dir: 1 | -1) => {
    const t = track.current!
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: smooth ? 'smooth' : 'auto' })
  }
  const arrows = canPrev || canNext

  return (
    <div className="carousel" role="group" aria-roledescription="carrusel" aria-label={label}>
      {arrows && <button className="carousel-arrow prev" aria-label="Anterior" disabled={!canPrev} onClick={() => scroll(-1)}>‹</button>}
      <div className="carousel-track" ref={track}>{children}</div>
      {arrows && <button className="carousel-arrow next" aria-label="Siguiente" disabled={!canNext} onClick={() => scroll(1)}>›</button>}
    </div>
  )
}
