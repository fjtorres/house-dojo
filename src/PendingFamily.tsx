import { useEffect, useEffectEvent } from 'react'
import { supabase } from './lib/supabase'
import { useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

type Props = { familyId: string; name: string; onChange: () => void }

export function PendingFamily({ familyId, name, onChange }: Props) {
  const t = useT()
  const changed = useEffectEvent(onChange)
  // the admin's decision arrives over Realtime, so the screen moves on by itself
  useEffect(() => {
    const channel = supabase
      .channel(`family-status:${familyId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${familyId}` }, () => changed())
      // a decision made before the channel was (re)joined sends no event: check again once listening
      .subscribe((status) => status === 'SUBSCRIBED' && changed())
    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId])

  return (
    <main className="page narrow">
      <h1 className="logo">🥋 House Dojo</h1>
      <section className="card notice">
        <div className="notice-icon" aria-hidden>⏳</div>
        <h2>{t.pending.title(name)}</h2>
        <p>{t.pending.help}</p>
      </section>
      <button className="link" onClick={() => supabase.auth.signOut()}>{t.common.signOut}</button>
      <LanguagePicker />
    </main>
  )
}
