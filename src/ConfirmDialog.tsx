import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { useT } from './i18n'

export type ConfirmOptions = {
  title: string
  message?: ReactNode
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

// Confirmation modal; use it through useConfirm().
export function ConfirmDialog({ title, message, icon, confirmLabel, cancelLabel, danger, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const t = useT()
  return (
    <Modal labelledBy="confirm-title" onClose={() => onClose(false)}>
      {icon && <div className="confirm-icon" aria-hidden>{icon}</div>}
      <h2 id="confirm-title">{title}</h2>
      {message && <p>{message}</p>}
      <div className="confirm-actions">
        {/* first button gets the focus: the safe choice */}
        <button onClick={() => onClose(false)}>{cancelLabel ?? t.common.cancel}</button>
        <button className={danger ? 'danger-fill' : 'primary'} onClick={() => onClose(true)}>{confirmLabel ?? t.common.yes}</button>
      </div>
    </Modal>
  )
}
