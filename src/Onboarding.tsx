import { useState, type FormEvent } from 'react'
import { errorText, supabase } from './lib/supabase'

// rejected: name of the user's family request an admin turned down, if any
type Props = { anonymous: boolean; isAdmin: boolean; rejected?: string; onJoined: () => void }

export function Onboarding({ anonymous, isAdmin, rejected, onJoined }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
          <h2>No se aceptó «{rejected}»</h2>
          <p>Puedes pedir otra familia o unirte a una con su código.</p>
        </section>
      )}
      {!anonymous && (
        <section className="card">
          <h2>Crear una familia</h2>
          <p>Un administrador la revisará antes de que podáis usarla.</p>
          <form onSubmit={create} className="stack">
            <label>
              Nombre de la familia
              <input name="family" required maxLength={80} placeholder="Los García" />
            </label>
            <button className="primary" disabled={busy}>Crear</button>
          </form>
        </section>
      )}
      <section className="card">
        <h2>Unirse con un código</h2>
        <p>{anonymous ? 'Pide el código a papá o mamá (lo ven en ⚙️ Padres).' : 'Si otro adulto ya creó la familia, usa su código. Él te podrá hacer padre/madre.'}</p>
        <form onSubmit={join} className="stack">
          <label>
            Código
            <input name="code" required autoCapitalize="none" autoComplete="off" />
          </label>
          <label>
            {anonymous ? 'Nombre de este dispositivo' : 'Tu nombre'}
            <input name="name" maxLength={60} placeholder={anonymous ? 'Tablet del salón' : ''} />
          </label>
          <button className="primary" disabled={busy}>Unirme</button>
        </form>
      </section>
      {error && <p className="error">{error}</p>}
      {isAdmin && <a className="button" href="#/admin">🛡️ Administración</a>}
      <button className="link" onClick={() => supabase.auth.signOut()}>Salir</button>
    </main>
  )
}
