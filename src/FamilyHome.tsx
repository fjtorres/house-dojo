import { type CSSProperties } from 'react'
import { supabase } from './lib/supabase'
import { useFamily } from './useFamily'
import { ChildView } from './ChildView'
import { ParentPanel } from './ParentPanel'
import { go, useRoute } from './router'
import { Carousel } from './Carousel'
import { TopMenu } from './TopMenu'
import { useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

type Props = { familyId: string; userId: string; isAdmin: boolean }

export function FamilyHome({ familyId, userId, isAdmin }: Props) {
  const { data, error, reload } = useFamily(familyId)
  const route = useRoute()
  const t = useT()
  const [section, ...rest] = route
  const signOut = () => supabase.auth.signOut()

  if (error) {
    return (
      <main className="page narrow">
        <p className="error">{t.errors.loadFamily(error)}</p>
        <button className="link" onClick={signOut}>{t.common.signOut}</button>
      </main>
    )
  }
  if (!data) return <p className="center">{t.common.loading}</p>

  const isParent = data.members.some((m) => m.user_id === userId && m.role === 'parent')
  const child = section === 'child' ? data.children.find((c) => c.id === rest[0]) : undefined
  const name = data.family.name
  const options = (
    <>
      {isAdmin && <a className="button" href="#/admin" aria-label={t.common.admin} title={t.common.admin}>🛡️</a>}
      {isParent && section !== 'parents' && <a className="button" href="#/parents">{t.common.parents}</a>}
      <LanguagePicker />
      <button className="link" onClick={signOut}>{t.common.signOut}</button>
    </>
  )

  return (
    <main className="page">
      <header className="topbar">
        {route.length === 0 ? (
          <h1 className="logo" title={name}>🥋 {name}</h1>
        ) : (
          <a className="button" href="#/">{t.common.back}</a>
        )}
        {/* the same options: buttons on a wide screen, the ⋮ menu on a phone (see index.css) */}
        <nav className="wide-only">{options}</nav>
        <nav className="narrow-only"><TopMenu title={name}>{options}</TopMenu></nav>
      </header>

      {child ? (
        <ChildView child={child} data={data} isParent={isParent} reload={reload} txId={rest[1] === 'tx' ? rest[2] : undefined} />
      ) : section === 'parents' && isParent ? (
        // keyed by route so a page's error message doesn't follow you to the next page
        <ParentPanel key={route.join('/')} route={rest} data={data} userId={userId} reload={reload} />
      ) : (
        <>
          <Carousel label={t.home.kids}>
            {data.children.map((c) => {
              const pending = data.txs.filter((t) => t.child_id === c.id && t.status === 'pending').length
              return (
                <button key={c.id} className="kid-card" style={{ '--kid': c.color || '#7c5cff' } as CSSProperties} onClick={() => go(`#/child/${c.id}`)}>
                  <span className="avatar">{c.avatar || '🙂'}</span>
                  <span className="kid-name">{c.name}</span>
                  <span className="kid-points">{data.balances[c.id] ?? 0} ⭐</span>
                  {pending > 0 && <span className="badge">{t.home.toApprove(pending)}</span>}
                </button>
              )
            })}
          </Carousel>
          {data.children.length === 0 && (
            <p className="center">{isParent ? t.home.emptyParent : t.home.emptyKid}</p>
          )}
        </>
      )}
    </main>
  )
}
