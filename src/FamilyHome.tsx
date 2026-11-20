import { type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import { useFamily } from './useFamily'
import { ChildView } from './ChildView'
import { ParentPanel } from './ParentPanel'
import { go, useRoute } from './router'

type Props = { familyId: string; userId: string; isAdmin: boolean }

export function FamilyHome({ familyId, userId, isAdmin }: Props) {
  const { data, error, reload } = useFamily(familyId)
  const route = useRoute()
  const [section, ...rest] = route
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
  const child = section === 'child' ? data.children.find((c) => c.id === rest[0]) : undefined

  return (
    <main className="page">
      <header className="topbar">
        {route.length === 0 ? (
          <h1 className="logo">🥋 {data.family.name}</h1>
        ) : (
          <a className="button" href="#/">← Volver</a>
        )}
        <nav>
          {isAdmin && <a className="button" href="#/admin" aria-label="Administración" title="Administración">🛡️</a>}
          {isParent && section !== 'parents' && <a className="button" href="#/parents">⚙️ Padres</a>}
          <button className="link" onClick={signOut}>Salir</button>
        </nav>
      </header>

      {child ? (
        <ChildView child={child} data={data} isParent={isParent} reload={reload} txId={rest[1] === 'tx' ? rest[2] : undefined} />
      ) : section === 'parents' && isParent ? (
        // keyed by route so a page's error message doesn't follow you to the next page
        <ParentPanel key={route.join('/')} route={rest} data={data} userId={userId} reload={reload} />
      ) : (
        <>
          <div className="kids">
            {data.children.map((c) => {
              const pending = data.txs.filter((t) => t.child_id === c.id && t.status === 'pending').length
              return (
                <button key={c.id} className="kid-card" style={{ '--kid': c.color || '#7c5cff' } as CSSProperties} onClick={() => go(`#/child/${c.id}`)}>
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
