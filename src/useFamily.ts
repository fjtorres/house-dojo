import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Tables } from './lib/database.types'

export type Kind = 'earn' | 'penalty' | 'reward'
export type Child = Tables<'children'>
export type Item = Tables<'items'>
export type Member = Tables<'family_members'>
export type TxEvent = Pick<Tables<'transaction_events'>, 'id' | 'action' | 'actor_name' | 'actor_role' | 'created_at'>
export type Tx = Tables<'transactions'> & {
  items: Pick<Item, 'name' | 'icon' | 'kind'> | null
  transaction_events: TxEvent[]
}

export type FamilyData = {
  family: Tables<'families'>
  members: Member[]
  children: Child[]
  items: Item[]
  balances: Record<string, number>
  txs: Tx[]
}

// Loads the whole family and reloads on any change from any device (Supabase Realtime).
export function useFamily(familyId: string) {
  const [data, setData] = useState<FamilyData>()
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const [family, members, children, items, balances, txs] = await Promise.all([
      supabase.from('families').select().eq('id', familyId).single(),
      supabase.from('family_members').select().eq('family_id', familyId).order('name'),
      supabase.from('children').select().eq('family_id', familyId).order('created_at'),
      supabase.from('items').select().eq('family_id', familyId).eq('archived', false).order('points'),
      supabase.from('child_balances').select().eq('family_id', familyId),
      // shortcut: last 300 transactions only; paginate the history if a family outgrows it.
      supabase.from('transactions').select('*, items(name, icon, kind), transaction_events(id, action, actor_name, actor_role, created_at)').eq('family_id', familyId)
        .order('created_at', { ascending: false }).limit(300),
    ])
    const failed = [family, members, children, items, balances, txs].find((r) => r.error)?.error
    if (failed) return setError(failed.message)
    setError('')
    setData({
      family: family.data!,
      members: members.data!,
      children: children.data!,
      items: items.data!,
      balances: Object.fromEntries(balances.data!.map((b) => [b.child_id, b.points ?? 0])),
      txs: txs.data as Tx[],
    })
  }, [familyId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reload only sets state after awaiting the network
    reload()
    // unique name: supabase-js reuses a channel by name, and StrictMode re-subscribes while the old one closes
    const channel = supabase.channel(`family:${familyId}:${crypto.randomUUID()}`)
    for (const table of ['transactions', 'children', 'items']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, () => reload())
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId, reload])

  return { data, error, reload }
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
export const itemValue = (item: Pick<Item, 'kind' | 'points'>) => (item.kind === 'earn' ? item.points : -item.points)

// A rejected movement was either turned down while pending or undone after approval.
export const txStatusLabel = (tx: Tx) =>
  tx.status === 'pending' ? 'por aprobar'
    : tx.status === 'approved' ? 'aprobado'
      : tx.transaction_events.some((e) => e.action === 'undone') ? 'anulado' : 'rechazado'
