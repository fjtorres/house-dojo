import { useEffect, useRef, type ReactNode } from 'react'

export type ConfirmOptions = {
  title: string
  message?: ReactNode
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

// Modal confirmation drawn with <dialog>; use it through useConfirm().
export function ConfirmDialog({ title, message, icon, confirmLabel = 'Sí', cancelLabel = 'Cancelar', danger, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  // showModal: centred, backdrop, focus kept inside, Escape fires `cancel`
  useEffect(() => ref.current?.showModal(), [])

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      onCancel={(e) => { e.preventDefault(); onClose(false) }}
      onClick={(e) => e.target === ref.current && onClose(false)} // click on the backdrop
    >
      <div>
        {icon && <div className="confirm-icon" aria-hidden>{icon}</div>}
        <h2 id="confirm-title">{title}</h2>
        {message && <p>{message}</p>}
        <div className="confirm-actions">
          {/* first button gets the focus: the safe choice */}
          <button onClick={() => onClose(false)}>{cancelLabel}</button>
          <button className={danger ? 'danger-fill' : 'primary'} onClick={() => onClose(true)}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
