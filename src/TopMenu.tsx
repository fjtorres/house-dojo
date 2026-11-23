import { useId, type ReactNode } from 'react'
import { useT } from './i18n'

type Props = { title: string; children: ReactNode }

// The "⋮" menu of narrow screens: a native popover, so Escape and a tap outside close it.
export function TopMenu({ title, children }: Props) {
  const id = useId()
  const t = useT()
  return (
    <>
      <button className="menu-button" popoverTarget={id} aria-label={t.common.menu}>⋮</button>
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
