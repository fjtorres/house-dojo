import { useState, type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import { useFamily } from './useFamily'
import { ChildView } from './ChildView'
import { ParentPanel } from './ParentPanel'

type Props = { familyId: string; userId: string }

export function FamilyHome({ familyId, userId }: Props) {
  const { data, error, reload } = useFamily(familyId)
  const [view, setView] = useState<string>('grid') // 'grid' | 'parents' | a child id
  const signOut = () => supabase.auth.signOut()

  if (error) {
    return (
      <main className="page narrow">
        <p className="error">No se pudo cargar la familia: {error}</p>
        <button className="link" onClick={signOut}>Salir</button>
      </main>
    )
  }
  if (!data) return <p className="center">Cargando…</p>

  const isParent = data.members.some((m) => m.user_id === userId && m.role === 'parent')
  const child = data.children.find((c) => c.id === view)

  return (
    <main className="page">
      <header className="topbar">
        {view === 'grid' ? (
          <h1 className="logo">🥋 {data.family.name}</h1>
        ) : (
          <button className="back" onClick={() => setView('grid')}>← Volver</button>
        )}
        <nav>
          {isParent && view !== 'parents' && <button onClick={() => setView('parents')}>⚙️ Padres</button>}
          <button className="link" onClick={signOut}>Salir</button>
        </nav>
      </header>

      {child ? (
        <ChildView child={child} data={data} isParent={isParent} reload={reload} />
      ) : view === 'parents' && isParent ? (
        <ParentPanel data={data} userId={userId} reload={reload} />
      ) : (
        <>
          <div className="kids">
            {data.children.map((c) => {
              const pending = data.txs.filter((t) => t.child_id === c.id && t.status === 'pending').length
              return (
                <button key={c.id} className="kid-card" style={{ '--kid': c.color || '#7c5cff' } as CSSProperties} onClick={() => setView(c.id)}>
                  <span className="avatar">{c.avatar || '🙂'}</span>
                  <span className="kid-name">{c.name}</span>
                  <span className="kid-points">{data.balances[c.id] ?? 0} ⭐</span>
                  {pending > 0 && <span className="badge">{pending} por aprobar</span>}
                </button>
              )
            })}
          </div>
          {data.children.length === 0 && (
            <p className="center">{isParent ? 'Añade a los niños en ⚙️ Padres.' : 'Todavía no hay niños en esta familia.'}</p>
          )}
        </>
      )}
    </main>
  )
}
