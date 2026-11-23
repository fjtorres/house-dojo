import { useState, type FormEvent } from 'react'
import { errorText, supabase } from './lib/supabase'
import { useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

// rejected: name of the user's family request an admin turned down, if any
type Props = { anonymous: boolean; isAdmin: boolean; rejected?: string; onJoined: () => void }

export function Onboarding({ anonymous, isAdmin, rejected, onJoined }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()

  async function submit(e: FormEvent<HTMLFormElement>, call: (f: FormData) => PromiseLike<{ data: string | null; error: { message: string } | null }>) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await call(new FormData(e.currentTarget))
    setBusy(false)
    if (error) setError(errorText(error))
    else if (data) onJoined()
  }

  const join = (e: FormEvent<HTMLFormElement>) =>
    submit(e, (f) => supabase.rpc('join_family', { code: String(f.get('code')), member_name: String(f.get('name')) }))
  const create = (e: FormEvent<HTMLFormElement>) =>
    submit(e, (f) => supabase.rpc('create_family', { family_name: String(f.get('family')) }))

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
          <form onSubmit={create} className="stack">
            <label>
              {t.onboarding.familyName}
              <input name="family" required maxLength={40} placeholder={t.onboarding.familyPlaceholder} />
            </label>
            <button className="primary" disabled={busy}>{t.onboarding.create}</button>
          </form>
        </section>
      )}
      <section className="card">
        <h2>{t.onboarding.joinTitle}</h2>
        <p>{anonymous ? t.onboarding.joinHelpKid : t.onboarding.joinHelpAdult}</p>
        <form onSubmit={join} className="stack">
          <label>
            {t.onboarding.code}
            <input name="code" required autoCapitalize="none" autoComplete="off" />
          </label>
          <label>
            {anonymous ? t.onboarding.deviceName : t.onboarding.yourName}
            <input name="name" maxLength={60} placeholder={anonymous ? t.onboarding.devicePlaceholder : ''} />
          </label>
          <button className="primary" disabled={busy}>{t.onboarding.join}</button>
        </form>
      </section>
      {error && <p className="error">{error}</p>}
      {isAdmin && <a className="button" href="#/admin">🛡️ {t.common.admin}</a>}
      <button className="link" onClick={() => supabase.auth.signOut()}>{t.common.signOut}</button>
      <LanguagePicker />
    </main>
  )
}
