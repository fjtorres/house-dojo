import { useState } from 'react'
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

// In-app replacement for window.confirm: `if (await confirm({ title: '¿Seguro?' })) ...`
// Render the returned `dialog` element somewhere in the component.
export function useConfirm() {
  const [open, setOpen] = useState<ConfirmOptions & { resolve: (ok: boolean) => void }>()
  const confirm = (options: ConfirmOptions) => new Promise<boolean>((resolve) => setOpen({ ...options, resolve }))
  const close = (ok: boolean) => {
    open?.resolve(ok)
    setOpen(undefined)
  }
  const dialog = open && <ConfirmDialog {...open} onClose={close} />
  return [confirm, dialog] as const
}
