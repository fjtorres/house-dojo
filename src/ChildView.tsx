import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import { useConfirm } from './useConfirm'
import { itemValue, signed, type Child, type FamilyData, type Item, type Kind, type Tx } from './useFamily'

type Props = { child: Child; data: FamilyData; isParent: boolean; reload: () => void }

const sections: { kind: Kind; title: string; parentsOnly?: boolean }[] = [
  { kind: 'earn', title: '⭐ Ganar puntos' },
  { kind: 'reward', title: '🎁 Recompensas' },
  { kind: 'penalty', title: '⚠️ Restar puntos', parentsOnly: true },
]
const defaultIcon: Record<Kind, string> = { earn: '⭐', reward: '🎁', penalty: '⚠️' }

export function ChildView({ child, data, isParent, reload }: Props) {
  const points = data.balances[child.id] ?? 0
  const [toast, setToast] = useState<{ text: string; kind: Kind }>()
  const [confirm, confirmDialog] = useConfirm()
  const history = data.txs.filter((t) => t.child_id === child.id)
  // pending deductions already count as spent, so a reward can't be requested twice with the same points
  const available = points + history.filter((t) => t.status === 'pending' && t.points < 0).reduce((sum, t) => sum + t.points, 0)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  async function record(item: Item) {
    const { error } = await supabase.from('transactions').insert({
      family_id: child.family_id,
      child_id: child.id,
      item_id: item.id,
      points: 0, // the database sets the real value from the item
      status: isParent ? 'approved' : 'pending',
    })
    if (error) return setToast({ text: 'No se pudo guardar 😕', kind: 'penalty' })
    const kind = item.kind as Kind
    setToast({
      text: isParent ? `${item.icon || defaultIcon[kind]} ${signed(itemValue(item))}` : '¡Enviado! Papá o mamá lo tienen que aprobar 👍',
      kind,
    })
    reload()
  }

  async function setStatus(tx: Tx, status: 'approved' | 'rejected') {
    if (status === 'rejected' && tx.status === 'approved') {
      const ok = await confirm({
        icon: '↩️',
        title: '¿Anular este movimiento?',
        message: `«${tx.items?.name}» (${signed(tx.points)}) dejará de contar en los puntos de ${child.name}.`,
        confirmLabel: 'Anular',
        danger: true,
      })
      if (!ok) return
    }
    await supabase.from('transactions').update({ status }).eq('id', tx.id)
    reload()
  }

  return (
    <div className="child-view" style={{ '--kid': child.color || '#7c5cff' } as CSSProperties}>
      <section className="hero">
        <span className="avatar big">{child.avatar || '🙂'}</span>
        <h2>{child.name}</h2>
        <p className="hero-points" key={points}>{points} ⭐</p>
      </section>

      {sections
        .filter((s) => isParent || !s.parentsOnly)
        .map((s) => {
          const items = data.items.filter((i) => i.kind === s.kind)
          if (items.length === 0) return null
          return (
            <section key={s.kind}>
              <h3>{s.title}</h3>
              <div className="items">
                {items.map((item) => {
                  const tooExpensive = item.kind === 'reward' && item.points > available
                  return (
                    <button key={item.id} className={`item ${item.kind}`} disabled={tooExpensive} onClick={() => record(item)}>
                      <span className="item-icon">{item.icon || defaultIcon[s.kind]}</span>
                      <span className="item-name">{item.name}</span>
                      <span className="item-points">{signed(itemValue(item))}</span>
                      {tooExpensive && <span className="item-hint">te faltan {item.points - available}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

      <section>
        <h3>📜 Historial</h3>
        {history.length === 0 && <p>Todavía no hay nada. ¡A por los primeros puntos!</p>}
        <ul className="history">
          {history.map((t) => (
            <li key={t.id} className={t.status}>
              <span className="item-icon">{t.items?.icon || defaultIcon[(t.items?.kind as Kind) ?? 'earn']}</span>
              <span className="grow">
                {t.items?.name}
                <small>{new Date(t.created_at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
              </span>
              <b className={t.points >= 0 ? 'plus' : 'minus'}>{signed(t.points)}</b>
              {t.status === 'pending' &&
                (isParent ? (
                  <span className="actions">
                    <button className="ok" aria-label="Aprobar" onClick={() => setStatus(t, 'approved')}>✓</button>
                    <button className="ko" aria-label="Rechazar" onClick={() => setStatus(t, 'rejected')}>✗</button>
                  </span>
                ) : (
                  <span className="tag">por aprobar</span>
                ))}
              {t.status === 'approved' && isParent && (
                <button className="link" aria-label="Anular" onClick={() => setStatus(t, 'rejected')}>↩</button>
              )}
              {t.status === 'rejected' && <span className="tag">anulado</span>}
            </li>
          ))}
        </ul>
      </section>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
      {confirmDialog}
    </div>
  )
}
