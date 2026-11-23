import { useCallback, useEffect, useState } from 'react'
import { errorText, supabase } from './lib/supabase'
import type { Database } from './lib/database.types'
import { useConfirm } from './useConfirm'
import { useLang, useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

type Family = Database['public']['Functions']['admin_families']['Returns'][number]
type Status = 'pending' | 'approved' | 'rejected'

const statuses: Status[] = ['pending', 'approved', 'rejected']
const day = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })

// Access is enforced in the admin_* database functions; this screen only calls them.
export function AdminPanel() {
  const t = useT()
  const lang = useLang()
  const empty: Partial<Record<Status, string>> = { pending: t.admin.emptyPending, approved: t.admin.emptyApproved }
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
      title: t.admin.deleteTitle(f.name),
      message: t.admin.deleteMessage(f.kids, f.movements),
      confirmLabel: t.admin.deleteFamily,
      danger: true,
    })
    if (ok) run(supabase.rpc('admin_delete_family', { fid: f.id }))
  }

  return (
    <main className="page admin">
      <header className="topbar">
        <a className="button" href="#/">{t.common.back}</a>
        <h1 className="logo">{t.admin.title}</h1>
      </header>
      {!families && <p className="center">{t.common.loading}</p>}
      {families && statuses.map((status) => {
        const list = families.filter((f) => f.status === status)
        if (!list.length && !empty[status]) return null
        return (
          <section key={status} className="card">
            <h2>{t.admin.sections[status]}</h2>
            {!list.length && <p>{empty[status]}</p>}
            <ul className="rows">
              {list.map((f) => (
                <li key={f.id}>
                  <span className="grow">
                    <b>{f.name}</b>
                    <small>
                      {status === 'approved'
                        ? t.admin.stats(f.parents, f.kids, f.movements)
                        : `${f.email ?? t.admin.deletedUser} · ${day(f.created_at, lang)}`}
                    </small>
                  </span>
                  {status !== 'approved' && <button className="primary" onClick={() => setStatus(f, 'approved')}>{t.admin.approve}</button>}
                  {status === 'pending' && <button className="link danger" onClick={() => setStatus(f, 'rejected')}>{t.admin.reject}</button>}
                  {status !== 'pending' && <button className="link danger" onClick={() => remove(f)}>{t.common.delete}</button>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {error && <p className="error">{error}</p>}
      {confirmDialog}
      <LanguagePicker />
    </main>
  )
}
