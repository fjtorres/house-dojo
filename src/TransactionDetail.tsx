import { Modal } from './Modal'
import { signed, txStatusLabel, type Tx, type TxEvent } from './useFamily'

type Props = { tx: Tx; isParent: boolean; defaultIcon: string; onClose: () => void }

const actionLabel: Record<string, [icon: string, label: string]> = {
  created: ['📝', 'Propuesto'],
  approved: ['✅', 'Aprobado'],
  rejected: ['✗', 'Rechazado'],
  undone: ['↩️', 'Anulado'],
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Kids see "papá o mamá" and device names, never an adult's email.
function who(e: TxEvent, isParent: boolean) {
  if (!e.actor_name) return 'alguien que ya no está'
  if (isParent) return e.actor_name
  if (e.actor_role === 'parent') return 'papá o mamá'
  return e.actor_name.includes('@') ? 'un adulto' : e.actor_name
}

export function TransactionDetail({ tx, isParent, defaultIcon, onClose }: Props) {
  const events = [...tx.transaction_events].sort((a, b) => a.id - b.id)
  // approvals before the audit trail existed were not recorded
  const missingApproval = tx.status === 'approved' && !events.some((e) => e.action === 'approved')

  return (
    <Modal labelledBy="tx-title" onClose={onClose}>
      <div className="modal-icon" aria-hidden>{tx.items?.icon || defaultIcon}</div>
      <h2 id="tx-title">{tx.items?.name}</h2>
      <p>
        <b className={tx.points >= 0 ? 'plus' : 'minus'}>{signed(tx.points)} ⭐</b> · {txStatusLabel(tx)}
      </p>
      <ol className="timeline" aria-label="Historial del movimiento">
        {events.map((e) => {
          const [icon, label] = actionLabel[e.action]
          const verb = e.action === 'created' && e.actor_role === 'parent' ? 'Registrado' : label
          return (
            <li key={e.id}>
              <span aria-hidden>{icon}</span>
              <span>
                {verb} por <b>{who(e, isParent)}</b>
                <small>{when(e.created_at)}</small>
              </span>
            </li>
          )
        })}
        {missingApproval && (
          <li>
            <span aria-hidden>✅</span>
            <span>Aprobado<small>sin fecha registrada</small></span>
          </li>
        )}
      </ol>
      <button className="primary" onClick={onClose}>Cerrar</button>
    </Modal>
  )
}
