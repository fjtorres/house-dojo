import { useState, type FormEvent } from 'react'
import { errorText, supabase } from './lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
        <h2>Papás y mamás</h2>
        {sent ? (
          <p>📬 Te hemos enviado un enlace a <b>{email}</b>. Ábrelo en este dispositivo para entrar.</p>
        ) : (
          <form onSubmit={sendLink} className="stack">
            <label>
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="primary" disabled={busy}>Enviarme un enlace</button>
          </form>
        )}
      </section>
      <section className="card">
        <h2>Dispositivo de los niños</h2>
        <p>Para la tablet de casa: se une a la familia con el código que ven papá o mamá.</p>
        <button className="big" disabled={busy} onClick={kidsDevice}>🧒 Usar este dispositivo</button>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  )
}
