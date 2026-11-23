import { Modal } from './Modal'
import { signed, txStatusLabel, type Tx, type TxEvent } from './useFamily'
import { useLang, useT } from './i18n'
import type { Messages } from './i18n/es'

type Props = { tx: Tx; isParent: boolean; defaultIcon: string; onClose: () => void }

const actionIcon: Record<string, string> = { created: '📝', approved: '✅', rejected: '✗', undone: '↩️' }

const when = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Kids see "Mom or Dad" and device names, never an adult's email.
function who(e: TxEvent, isParent: boolean, t: Messages) {
  if (!e.actor_name) return t.tx.gone
  if (isParent) return e.actor_name
  if (e.actor_role === 'parent') return t.tx.parent
  return e.actor_name.includes('@') ? t.tx.adult : e.actor_name
}

export function TransactionDetail({ tx, isParent, defaultIcon, onClose }: Props) {
  const t = useT()
  const lang = useLang()
  const events = [...tx.transaction_events].sort((a, b) => a.id - b.id)
  // approvals before the audit trail existed were not recorded
  const missingApproval = tx.status === 'approved' && !events.some((e) => e.action === 'approved')

  return (
    <Modal labelledBy="tx-title" onClose={onClose}>
      <div className="modal-icon" aria-hidden>{tx.items?.icon || defaultIcon}</div>
      <h2 id="tx-title">{tx.items?.name}</h2>
      <p>
        <b className={tx.points >= 0 ? 'plus' : 'minus'}>{signed(tx.points)} ⭐</b> · {txStatusLabel(tx, t)}
      </p>
      <ol className="timeline" aria-label={t.tx.timeline}>
        {events.map((e) => {
          const verb = e.action === 'created' && e.actor_role === 'parent' ? t.tx.recorded : t.tx.actions[e.action]
          return (
            <li key={e.id}>
              <span aria-hidden>{actionIcon[e.action]}</span>
              <span>
                {t.tx.by(verb, <b>{who(e, isParent, t)}</b>)}
                <small>{when(e.created_at, lang)}</small>
              </span>
            </li>
          )
        })}
        {missingApproval && (
          <li>
            <span aria-hidden>✅</span>
            <span>{t.tx.actions.approved}<small>{t.tx.approvedNoDate}</small></span>
          </li>
        )}
      </ol>
      <button className="primary" onClick={onClose}>{t.tx.close}</button>
    </Modal>
  )
}
