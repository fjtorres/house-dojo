import { useActionState } from 'react'
import { errorText, supabase } from './lib/supabase'
import { useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

type LinkState = { email: string; sent?: boolean; error?: string }

export function Login() {
  const t = useT()
  // form actions (React 19): React passes the FormData and tracks the pending state
  const [link, sendLink, sending] = useActionState(async (_: LinkState, form: FormData): Promise<LinkState> => {
    const email = String(form.get('email'))
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    })
    // the email goes back in as defaultValue: React empties the form after the action
    return error ? { email, error: errorText(error) } : { email, sent: true }
  }, { email: '' })
  const [kidsError, signInDevice, signingIn] = useActionState(async () => {
    const { error } = await supabase.auth.signInAnonymously()
    return error ? errorText(error) : ''
  }, '')
  const busy = sending || signingIn
  const error = link.error || kidsError

  return (
    <main className="page narrow">
      <h1 className="logo">🥋 House Dojo</h1>
      <section className="card">
        <h2>{t.login.parentsTitle}</h2>
        {link.sent ? (
          <p>{t.login.linkSent(<b>{link.email}</b>)}</p>
        ) : (
          <form action={sendLink} className="stack">
            <label>
              {t.login.email}
              <input name="email" type="email" required defaultValue={link.email} />
            </label>
            <button className="primary" disabled={busy}>{t.login.sendLink}</button>
          </form>
        )}
      </section>
      <section className="card">
        <h2>{t.login.kidsTitle}</h2>
        <p>{t.login.kidsHelp}</p>
        <form action={signInDevice}>
          <button className="big" disabled={busy}>{t.login.useDevice}</button>
        </form>
      </section>
      {error && <p className="error">{error}</p>}
      <LanguagePicker />
    </main>
  )
}
