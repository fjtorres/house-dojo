import { useState, type FormEvent } from 'react'
import { errorText, supabase } from './lib/supabase'
import { useT } from './i18n'
import { LanguagePicker } from './LanguagePicker'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    })
    setBusy(false)
    if (error) setError(errorText(error))
    else setSent(true)
  }

  async function kidsDevice() {
    setBusy(true)
    const { error } = await supabase.auth.signInAnonymously()
    setBusy(false)
    if (error) setError(errorText(error))
  }

  return (
    <main className="page narrow">
      <h1 className="logo">🥋 House Dojo</h1>
      <section className="card">
        <h2>{t.login.parentsTitle}</h2>
        {sent ? (
          <p>{t.login.linkSent(<b>{email}</b>)}</p>
        ) : (
          <form onSubmit={sendLink} className="stack">
            <label>
              {t.login.email}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="primary" disabled={busy}>{t.login.sendLink}</button>
          </form>
        )}
      </section>
      <section className="card">
        <h2>{t.login.kidsTitle}</h2>
        <p>{t.login.kidsHelp}</p>
        <button className="big" disabled={busy} onClick={kidsDevice}>{t.login.useDevice}</button>
      </section>
      {error && <p className="error">{error}</p>}
      <LanguagePicker />
    </main>
  )
}
