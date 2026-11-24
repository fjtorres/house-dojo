import { useActionState } from 'react'
import { errorText, supabase } from './lib/supabase'
import { useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

// rejected: name of the user's family request an admin turned down, if any
type Props = { anonymous: boolean; isAdmin: boolean; rejected?: string; onJoined: () => void }
// what was typed goes back in as defaultValue: React empties the form after the action
type FormState = { error?: string; values: Record<string, string> }
type Rpc = PromiseLike<{ data: string | null; error: { message: string } | null }>

export function Onboarding({ anonymous, isAdmin, rejected, onJoined }: Props) {
  const t = useT()
  const action = (call: (values: Record<string, string>) => Rpc) => async (_: FormState, form: FormData): Promise<FormState> => {
    const values = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]))
    const { data, error } = await call(values)
    if (error) return { error: errorText(error), values }
    if (data) onJoined()
    return { values: {} }
  }
  const [created, create, creating] = useActionState(
    action((v) => supabase.rpc('create_family', { family_name: v.family })), { values: {} })
  const [joined, join, joining] = useActionState(
    action((v) => supabase.rpc('join_family', { code: v.code, member_name: v.name })), { values: {} })
  const busy = creating || joining

  return (
    <main className="page narrow">
      <h1 className="logo">🥋 House Dojo</h1>
      {rejected && (
        <section className="card notice">
          <div className="notice-icon" aria-hidden>🚫</div>
          <h2>{t.onboarding.rejected(rejected)}</h2>
          <p>{t.onboarding.rejectedHelp}</p>
        </section>
      )}
      {!anonymous && (
        <section className="card">
          <h2>{t.onboarding.createTitle}</h2>
          <p>{t.onboarding.createHelp}</p>
          <form action={create} className="stack">
            <label>
              {t.onboarding.familyName}
              <input name="family" required maxLength={40} placeholder={t.onboarding.familyPlaceholder} defaultValue={created.values.family} />
            </label>
            <button className="primary" disabled={busy}>{t.onboarding.create}</button>
          </form>
          {created.error && <p className="error">{created.error}</p>}
        </section>
      )}
      <section className="card">
        <h2>{t.onboarding.joinTitle}</h2>
        <p>{anonymous ? t.onboarding.joinHelpKid : t.onboarding.joinHelpAdult}</p>
        <form action={join} className="stack">
          <label>
            {t.onboarding.code}
            <input name="code" required autoCapitalize="none" autoComplete="off" defaultValue={joined.values.code} />
          </label>
          <label>
            {anonymous ? t.onboarding.deviceName : t.onboarding.yourName}
            <input name="name" maxLength={60} placeholder={anonymous ? t.onboarding.devicePlaceholder : ''} defaultValue={joined.values.name} />
          </label>
          <button className="primary" disabled={busy}>{t.onboarding.join}</button>
        </form>
        {joined.error && <p className="error">{joined.error}</p>}
      </section>
      {isAdmin && <a className="button" href="#/admin">🛡️ {t.common.admin}</a>}
      <button className="link" onClick={() => supabase.auth.signOut()}>{t.common.signOut}</button>
      <LanguagePicker />
    </main>
  )
}
