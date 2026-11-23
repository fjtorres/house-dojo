import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import { useConfirm } from './useConfirm'
import { itemValue, signed, txStatusLabel, type Child, type FamilyData, type Item, type Kind, type Tx } from './useFamily'
import { TransactionDetail } from './TransactionDetail'
import { useLang, useT } from './i18n'

// txId: movement whose detail is open (#/child/<id>/tx/<txId>)
type Props = { child: Child; data: FamilyData; isParent: boolean; reload: () => void; txId?: string }

const sections: { kind: Kind; parentsOnly?: boolean }[] = [{ kind: 'earn' }, { kind: 'reward' }, { kind: 'penalty', parentsOnly: true }]
const defaultIcon: Record<Kind, string> = { earn: '⭐', reward: '🎁', penalty: '⚠️' }

export function ChildView({ child, data, isParent, reload, txId }: Props) {
  const t = useT()
  const lang = useLang()
  const points = data.balances[child.id] ?? 0
  const [toast, setToast] = useState<{ text: string; kind: Kind }>()
  const [confirm, confirmDialog] = useConfirm()
  const history = data.txs.filter((t) => t.child_id === child.id)
  const detail = txId ? history.find((t) => t.id === txId) : undefined
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
    if (error) return setToast({ text: t.errors.saveFailed, kind: 'penalty' })
    const kind = item.kind as Kind
    setToast({
      text: isParent ? `${item.icon || defaultIcon[kind]} ${signed(itemValue(item))}` : t.child.sent,
      kind,
    })
    reload()
  }

  async function setStatus(tx: Tx, status: 'approved' | 'rejected') {
    if (status === 'rejected' && tx.status === 'approved') {
      const ok = await confirm({
        icon: '↩️',
        title: t.child.undoTitle,
        message: t.child.undoMessage(tx.items?.name ?? '', signed(tx.points), child.name),
        confirmLabel: t.child.undo,
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
              <h3>{t.child.sections[s.kind]}</h3>
              <div className="items">
                {items.map((item) => {
                  const tooExpensive = item.kind === 'reward' && item.points > available
                  return (
                    <button key={item.id} className={`item ${item.kind}`} disabled={tooExpensive} onClick={() => record(item)}>
                      <span className="item-icon">{item.icon || defaultIcon[s.kind]}</span>
                      <span className="item-name">{item.name}</span>
                      <span className="item-points">{signed(itemValue(item))}</span>
                      {tooExpensive && <span className="item-hint">{t.child.missing(item.points - available)}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

      <section>
        <h3>{t.child.history}</h3>
        {history.length === 0 && <p>{t.child.historyEmpty}</p>}
        <ul className="history">
          {history.map((tx) => (
            <li key={tx.id} className={tx.status}>
              <a className="tx-link" href={`#/child/${child.id}/tx/${tx.id}`}>
                <span className="item-icon">{tx.items?.icon || defaultIcon[(tx.items?.kind as Kind) ?? 'earn']}</span>
                <span className="grow">
                  {tx.items?.name}
                  <small>{new Date(tx.created_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                </span>
              </a>
              <b className={tx.points >= 0 ? 'plus' : 'minus'}>{signed(tx.points)}</b>
              {tx.status === 'pending' &&
                (isParent ? (
                  <span className="actions">
                    <button className="ok" aria-label={t.child.approve} onClick={() => setStatus(tx, 'approved')}>✓</button>
                    <button className="ko" aria-label={t.child.reject} onClick={() => setStatus(tx, 'rejected')}>✗</button>
                  </span>
                ) : (
                  <span className="tag">{t.txStatus.pending}</span>
                ))}
              {tx.status === 'approved' && isParent && (
                <button className="link" aria-label={t.child.undo} onClick={() => setStatus(tx, 'rejected')}>↩</button>
              )}
              {tx.status === 'rejected' && <span className="tag">{txStatusLabel(tx, t)}</span>}
            </li>
          ))}
        </ul>
      </section>

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
      {confirmDialog}
      {detail && (
        // closing goes back in history, so Escape, Close and the browser's back button all agree
        <TransactionDetail tx={detail} isParent={isParent} defaultIcon={defaultIcon[(detail.items?.kind as Kind) ?? 'earn']} onClose={() => window.history.back()} />
      )}
    </div>
  )
}
