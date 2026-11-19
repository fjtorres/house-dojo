import { useCallback, useEffect, useState } from 'react'
import { errorText, supabase } from './lib/supabase'
import type { Database } from './lib/database.types'
import { useConfirm } from './useConfirm'

type Family = Database['public']['Functions']['admin_families']['Returns'][number]
type Status = 'pending' | 'approved' | 'rejected'

const sections: { status: Status; title: string; empty?: string }[] = [
  { status: 'pending', title: '⏳ Solicitudes pendientes', empty: 'No hay solicitudes pendientes.' },
  { status: 'approved', title: '✅ Familias aprobadas', empty: 'Todavía no hay familias.' },
  { status: 'rejected', title: '🚫 Rechazadas' },
]
const day = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

// Access is enforced in the admin_* database functions; this screen only calls them.
export function AdminPanel() {
  const [families, setFamilies] = useState<Family[]>()
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_families')
    setError(error ? errorText(error) : '')
    setFamilies(data ?? [])
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load only sets state after awaiting the network
    load()
  }, [load])

  async function run(call: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await call
    setError(error ? errorText(error) : '')
    load()
  }
  const setStatus = (f: Family, status: Status) => run(supabase.rpc('admin_set_family_status', { fid: f.id, new_status: status }))

  async function remove(f: Family) {
    const ok = await confirm({
      icon: '🗑️',
      title: `¿Borrar la familia «${f.name}»?`,
      message: `Se borrarán sus ${f.kids} niños, ${f.movements} movimientos, sus tareas y sus miembros. No se puede deshacer.`,
      confirmLabel: 'Borrar familia',
      danger: true,
    })
    if (ok) run(supabase.rpc('admin_delete_family', { fid: f.id }))
  }

  return (
    <main className="page admin">
      <header className="topbar">
        <a className="button" href="#/">← Volver</a>
        <h1 className="logo">🛡️ Administración</h1>
      </header>
      {!families && <p className="center">Cargando…</p>}
      {families && sections.map(({ status, title, empty }) => {
        const list = families.filter((f) => f.status === status)
        if (!list.length && !empty) return null
        return (
          <section key={status} className="card">
            <h2>{title}</h2>
            {!list.length && <p>{empty}</p>}
            <ul className="rows">
              {list.map((f) => (
                <li key={f.id}>
                  <span className="grow">
                    <b>{f.name}</b>
                    <small>
                      {status === 'approved'
                        ? `${f.parents} padres · ${f.kids} niños · ${f.movements} movimientos`
                        : `${f.email ?? 'usuario borrado'} · ${day(f.created_at)}`}
                    </small>
                  </span>
                  {status !== 'approved' && <button className="primary" onClick={() => setStatus(f, 'approved')}>✓ Aprobar</button>}
                  {status === 'pending' && <button className="link danger" onClick={() => setStatus(f, 'rejected')}>✗ Rechazar</button>}
                  {status !== 'pending' && <button className="link danger" onClick={() => remove(f)}>Borrar</button>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {error && <p className="error">{error}</p>}
      {confirmDialog}
    </main>
  )
}
