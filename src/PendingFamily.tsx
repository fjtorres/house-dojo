import { useEffect } from 'react'
import { supabase } from './lib/supabase'

type Props = { familyId: string; name: string; onChange: () => void }

export function PendingFamily({ familyId, name, onChange }: Props) {
  // the admin's decision arrives over Realtime, so the screen moves on by itself
  useEffect(() => {
    const channel = supabase
      .channel(`family-status:${familyId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'families', filter: `id=eq.${familyId}` }, () => onChange())
      // a decision made before the channel was (re)joined sends no event: check again once listening
      .subscribe((status) => status === 'SUBSCRIBED' && onChange())
    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId, onChange])

  return (
    <main className="page narrow">
      <h1 className="logo">🥋 House Dojo</h1>
      <section className="card notice">
        <div className="notice-icon" aria-hidden>⏳</div>
        <h2>«{name}» está pendiente de aprobación</h2>
        <p>Un administrador tiene que aceptar la familia. Esta pantalla cambiará sola en cuanto lo haga.</p>
      </section>
      <button className="link" onClick={() => supabase.auth.signOut()}>Salir</button>
    </main>
  )
}
