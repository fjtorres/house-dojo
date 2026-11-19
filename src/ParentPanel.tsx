import { useState, type FormEvent } from 'react'
import { errorText, supabase } from './lib/supabase'
import { itemValue, signed, type FamilyData, type Kind } from './useFamily'

type Props = { data: FamilyData; userId: string; reload: () => void }

const kindLabel: Record<Kind, string> = { earn: '⭐ Suman', penalty: '⚠️ Restan', reward: '🎁 Recompensas' }

export function ParentPanel({ data, userId, reload }: Props) {
  const [error, setError] = useState('')
  const familyId = data.family.id

  async function run(call: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await call
    setError(error ? errorText(error) : '')
    reload()
    return !error
  }

  async function addChild(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const ok = await run(supabase.from('children').insert({
      family_id: familyId,
      name: String(f.get('name')),
      avatar: String(f.get('avatar')) || null,
      color: String(f.get('color')),
    }))
    if (ok) form.reset()
  }

  async function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const ok = await run(supabase.from('items').insert({
      family_id: familyId,
      kind: String(f.get('kind')),
      name: String(f.get('name')),
      icon: String(f.get('icon')) || null,
      points: Number(f.get('points')),
    }))
    if (ok) form.reset()
  }

  return (
    <div className="panel">
      <section className="card">
        <h2>🔑 Código de la familia</h2>
        <p className="code">{data.family.invite_code}</p>
        <p>Úsalo en la tablet de los niños («Dispositivo de los niños») o para que otro adulto se una. Quien se une entra como niño; súbelo a padre/madre abajo.</p>
      </section>

      <section className="card">
        <h2>🧒 Niños</h2>
        <ul className="rows">
          {data.children.map((c) => (
            <li key={c.id}>
              <span className="avatar">{c.avatar || '🙂'}</span>
              <span className="grow">{c.name}</span>
              <button className="link danger" onClick={() =>
                confirm(`¿Borrar a ${c.name} y todo su historial?`) && run(supabase.from('children').delete().eq('id', c.id))
              }>Borrar</button>
            </li>
          ))}
        </ul>
        <form onSubmit={addChild} className="inline">
          <input name="avatar" placeholder="🦊" maxLength={4} className="emoji" aria-label="Emoji" />
          <input name="name" placeholder="Nombre" required maxLength={40} />
          <input name="color" type="color" defaultValue="#7c5cff" aria-label="Color" />
          <button className="primary">Añadir</button>
        </form>
      </section>

      <section className="card">
        <h2>📋 Tareas, faltas y recompensas</h2>
        {(['earn', 'penalty', 'reward'] as Kind[]).map((kind) => (
          <div key={kind}>
            <h3>{kindLabel[kind]}</h3>
            <ul className="rows">
              {data.items.filter((i) => i.kind === kind).map((i) => (
                <li key={i.id}>
                  <span className="avatar">{i.icon}</span>
                  <span className="grow">{i.name}</span>
                  <b>{signed(itemValue(i))}</b>
                  {/* archived, not deleted: the history keeps pointing at it */}
                  <button className="link danger" onClick={() => run(supabase.from('items').update({ archived: true }).eq('id', i.id))}>Quitar</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <form onSubmit={addItem} className="inline">
          <select name="kind" aria-label="Tipo">
            <option value="earn">Suma</option>
            <option value="penalty">Resta</option>
            <option value="reward">Recompensa</option>
          </select>
          <input name="icon" placeholder="📚" maxLength={4} className="emoji" aria-label="Emoji" />
          <input name="name" placeholder="Hacer los deberes" required maxLength={60} />
          <input name="points" type="number" min={1} defaultValue={10} required className="num" aria-label="Puntos" />
          <button className="primary">Añadir</button>
        </form>
      </section>

      <section className="card">
        <h2>👨‍👩‍👧 Miembros</h2>
        <ul className="rows">
          {data.members.map((m) => (
            <li key={m.user_id}>
              <span className="grow">{m.name}{m.user_id === userId && ' (tú)'}</span>
              <span className="tag">{m.role === 'parent' ? 'padre/madre' : 'niño'}</span>
              {m.user_id !== userId && (
                <>
                  <button className="link" onClick={() =>
                    run(supabase.from('family_members').update({ role: m.role === 'parent' ? 'child' : 'parent' })
                      .eq('family_id', familyId).eq('user_id', m.user_id))
                  }>{m.role === 'parent' ? 'Hacer niño' : 'Hacer padre/madre'}</button>
                  <button className="link danger" onClick={() =>
                    confirm(`¿Quitar a ${m.name} de la familia?`) &&
                    run(supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', m.user_id))
                  }>Quitar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
