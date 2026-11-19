import { useState, type FormEvent } from 'react'
import { errorText, supabase } from './lib/supabase'
import { itemValue, signed, type Child, type FamilyData, type Item, type Kind } from './useFamily'
import { EmojiPicker } from './EmojiPicker'
import { AVATARS, ICONS } from './emojis'

type Props = { data: FamilyData; userId: string; reload: () => void }

const kindLabel: Record<Kind, string> = { earn: '⭐ Suman', penalty: '⚠️ Restan', reward: '🎁 Recompensas' }

export function ParentPanel({ data, userId, reload }: Props) {
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string>()
  const familyId = data.family.id

  async function run(call: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await call
    setError(error ? errorText(error) : '')
    reload()
    return !error
  }

  const addChild = (child: ChildFields) => run(supabase.from('children').insert({ family_id: familyId, ...child }))
  const updateChild = async (id: string, child: ChildFields) => {
    const ok = await run(supabase.from('children').update(child).eq('id', id))
    if (ok) setEditing(undefined)
    return ok
  }

  const addItem = (item: ItemFields) => run(supabase.from('items').insert({ family_id: familyId, ...item }))
  // transactions keep their own points snapshot, so editing an item never rewrites history
  const updateItem = async (id: string, item: ItemFields) => {
    const ok = await run(supabase.from('items').update(item).eq('id', id))
    if (ok) setEditing(undefined)
    return ok
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
          {data.children.map((c) =>
            editing === c.id ? (
              <li key={c.id} className="editing">
                <ChildForm child={c} onSave={(v) => updateChild(c.id, v)} onCancel={() => setEditing(undefined)} />
              </li>
            ) : (
              <li key={c.id}>
                <span className="avatar">{c.avatar || '🙂'}</span>
                <span className="grow">{c.name}</span>
                <button className="link" onClick={() => setEditing(c.id)}>Editar</button>
                <button className="link danger" onClick={() =>
                  confirm(`¿Borrar a ${c.name} y todo su historial?`) && run(supabase.from('children').delete().eq('id', c.id))
                }>Borrar</button>
              </li>
            ),
          )}
        </ul>
        <h3>Añadir niño</h3>
        <ChildForm onSave={addChild} />
      </section>

      <section className="card">
        <h2>📋 Tareas, faltas y recompensas</h2>
        {(['earn', 'penalty', 'reward'] as Kind[]).map((kind) => (
          <div key={kind}>
            <h3>{kindLabel[kind]}</h3>
            <ul className="rows">
              {data.items.filter((i) => i.kind === kind).map((i) =>
                editing === i.id ? (
                  <li key={i.id} className="editing">
                    <ItemForm item={i} onSave={(v) => updateItem(i.id, v)} onCancel={() => setEditing(undefined)} />
                  </li>
                ) : (
                  <li key={i.id}>
                    <span className="avatar">{i.icon}</span>
                    <span className="grow">{i.name}</span>
                    <b>{signed(itemValue(i))}</b>
                    <button className="link" onClick={() => setEditing(i.id)}>Editar</button>
                    {/* archived, not deleted: the history keeps pointing at it */}
                    <button className="link danger" onClick={() => run(supabase.from('items').update({ archived: true }).eq('id', i.id))}>Quitar</button>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
        <h3>Añadir</h3>
        <ItemForm onSave={addItem} />
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

type ChildFields = { name: string; avatar: string; color: string }
type ChildFormProps = { child?: Child; onSave: (child: ChildFields) => Promise<boolean>; onCancel?: () => void }

function ChildForm({ child, onSave, onCancel }: ChildFormProps) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const ok = await onSave({ name: String(f.get('name')), avatar: String(f.get('avatar')), color: String(f.get('color')) })
    if (ok && !child) form.reset()
  }

  return (
    <form onSubmit={submit} className="inline">
      <EmojiPicker name="avatar" options={AVATARS} defaultValue={child?.avatar} label="Avatar" />
      <input name="name" placeholder="Nombre" required maxLength={40} defaultValue={child?.name} aria-label="Nombre" />
      <input name="color" type="color" defaultValue={child?.color || '#7c5cff'} aria-label="Color" />
      <button className="primary">{child ? 'Guardar' : 'Añadir'}</button>
      {onCancel && <button type="button" className="link" onClick={onCancel}>Cancelar</button>}
    </form>
  )
}

type ItemFields = { kind: string; name: string; icon: string; points: number }
type ItemFormProps = { item?: Item; onSave: (item: ItemFields) => Promise<boolean>; onCancel?: () => void }

function ItemForm({ item, onSave, onCancel }: ItemFormProps) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const ok = await onSave({
      kind: String(f.get('kind')),
      name: String(f.get('name')),
      icon: String(f.get('icon')),
      points: Number(f.get('points')),
    })
    if (ok && !item) form.reset()
  }

  return (
    <form onSubmit={submit} className="inline">
      <select name="kind" aria-label="Tipo" defaultValue={item?.kind}>
        <option value="earn">Suma</option>
        <option value="penalty">Resta</option>
        <option value="reward">Recompensa</option>
      </select>
      <EmojiPicker name="icon" options={ICONS} defaultValue={item?.icon} label="Icono" />
      <input name="name" placeholder="Hacer los deberes" required maxLength={60} defaultValue={item?.name} aria-label="Nombre" />
      <input name="points" type="number" min={1} defaultValue={item?.points ?? 10} required className="num" aria-label="Puntos" />
      <button className="primary">{item ? 'Guardar' : 'Añadir'}</button>
      {onCancel && <button type="button" className="link" onClick={onCancel}>Cancelar</button>}
    </form>
  )
}
