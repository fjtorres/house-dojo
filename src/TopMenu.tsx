import { useId, type ReactNode } from 'react'

type Props = { title: string; children: ReactNode }

// The "⋮" menu of narrow screens: a native popover, so Escape and a tap outside close it.
export function TopMenu({ title, children }: Props) {
  const id = useId()
  return (
    <>
      <button className="menu-button" popoverTarget={id} aria-label="Menú">⋮</button>
      <div
        id={id}
        popover="auto"
        className="menu"
        // choosing an option closes the menu
        onClick={(e) => (e.target as HTMLElement).closest('a, button') && e.currentTarget.hidePopover()}
      >
        <p className="menu-title">{title}</p>
        {children}
      </div>
    </>
  )
}
