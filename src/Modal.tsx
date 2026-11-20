import { useEffect, useRef, type ReactNode } from 'react'

type Props = { labelledBy: string; onClose: () => void; className?: string; children: ReactNode }

// Centred <dialog> with backdrop and focus kept inside; Escape and a click on the backdrop close it.
export function Modal({ labelledBy, onClose, className = '', children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div>{children}</div>
    </dialog>
  )
}
