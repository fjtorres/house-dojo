import { useState, type FormEvent, type ReactNode } from 'react'
import { errorText, supabase } from './lib/supabase'
import { itemValue, signed, type Child, type FamilyData, type Item, type Kind } from './useFamily'
import { EmojiPicker } from './EmojiPicker'
import { AVATARS, ICONS } from './emojis'
import { go } from './router'
import { useConfirm } from './useConfirm'

// route: the path after #/parents, e.g. [] | ['items'] | ['items', 'new'] | ['items', <id>]
type Props = { data: FamilyData; userId: string; reload: () => void; route: string[] }

const kindLabel: Record<Kind, string> = { earn: '⭐ Suman', penalty: '⚠️ Restan', reward: '🎁 Recompensas' }
const tabs = [
  ['children', '🧒', 'Niños'],
  ['items', '📋', 'Tareas'],
  ['members', '👨‍👩‍👧', 'Miembros'],
  ['code', '🔑', 'Código'],
] as const
const CHILDREN = '#/parents/children'
const ITEMS = '#/parents/items'

export function ParentPanel({ data, userId, reload, route }: Props) {
  const [error, setError] = useState('')
  const [confirm, confirmDialog] = useConfirm()
  const [tab = 'children', id] = route
  const familyId = data.family.id

  async function run(call: PromiseLike<{ error: { message: string } | null }>, then?: string) {
    const { error } = await call
    setError(error ? errorText(error) : '')
    reload()
    if (!error && then) go(then)
  }

  let page: ReactNode
  if (tab === 'children' && id) {
    const child = data.children.find((c) => c.id === id)
    page = id === 'new'
      ? <ChildForm onSave={(v) => run(supabase.from('children').insert({ family_id: familyId, ...v }), CHILDREN)} />
      : child
        ? <ChildForm child={child} onSave={(v) => run(supabase.from('children').update(v).eq('id', child.id), CHILDREN)} />
        : <NotFound back={CHILDREN} />
  } else if (tab === 'children') {
    page = (
      <section className="card">
        <Head title="🧒 Niños" add={`${CHILDREN}/new`} label="Añadir niño" />
        <ul className="rows">
          {data.children.map((c) => (
            <li key={c.id}>
              <span className="avatar">{c.avatar || '🙂'}</span>
              <span className="grow">{c.name}</span>
              <a className="link" href={`${CHILDREN}/${c.id}`}>Editar</a>
              <button className="link danger" onClick={async () =>
                await confirm({ icon: c.avatar || '🙂', title: `¿Borrar a ${c.name}?`, message: 'Se borrará también todo su historial de puntos. No se puede deshacer.', confirmLabel: 'Borrar', danger: true }) &&
                run(supabase.from('children').delete().eq('id', c.id))
              }>Borrar</button>
            </li>
          ))}
        </ul>
        {data.children.length === 0 && <p>Todavía no hay niños. Pulsa + para añadir uno.</p>}
      </section>
    )
  } else if (tab === 'items' && id) {
    const item = data.items.find((i) => i.id === id)
    page = id === 'new'
      ? <ItemForm onSave={(v) => run(supabase.from('items').insert({ family_id: familyId, ...v }), ITEMS)} />
      : item
        // transactions keep their own points snapshot, so editing an item never rewrites history
        ? <ItemForm item={item} onSave={(v) => run(supabase.from('items').update(v).eq('id', item.id), ITEMS)} />
        : <NotFound back={ITEMS} />
  } else if (tab === 'items') {
    page = (
      <section className="card">
        <Head title="📋 Tareas, faltas y recompensas" add={`${ITEMS}/new`} label="Añadir tarea" />
        {(['earn', 'penalty', 'reward'] as Kind[]).map((kind) => (
          <div key={kind}>
            <h3>{kindLabel[kind]}</h3>
            <ul className="rows">
              {data.items.filter((i) => i.kind === kind).map((i) => (
                <li key={i.id}>
                  <span className="avatar">{i.icon}</span>
                  <span className="grow">{i.name}</span>
                  <b>{signed(itemValue(i))}</b>
                  <a className="link" href={`${ITEMS}/${i.id}`}>Editar</a>
                  {/* archived, not deleted: the history keeps pointing at it */}
                  <button className="link danger" onClick={() => run(supabase.from('items').update({ archived: true }).eq('id', i.id))}>Quitar</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    )
  } else if (tab === 'members') {
    page = (
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
                  <button className="link danger" onClick={async () =>
                    await confirm({ icon: '👋', title: `¿Quitar a ${m.name} de la familia?`, message: 'Ese dispositivo o persona dejará de ver la familia. Podrá volver a unirse con el código.', confirmLabel: 'Quitar', danger: true }) &&
                    run(supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', m.user_id))
                  }>Quitar</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    )
  } else {
    page = (
      <section className="card">
        <h2>🔑 Código de la familia</h2>
        <p className="code">{data.family.invite_code}</p>
        <p>Úsalo en la tablet de los niños («Dispositivo de los niños») o para que otro adulto se una. Quien se une entra como niño; súbelo a padre/madre en Miembros.</p>
      </section>
    )
  }

  return (
    <div className="panel">
      <nav className="tabs" aria-label="Menú de padres">
        {tabs.map(([key, icon, label]) => (
          <a key={key} href={`#/parents/${key}`} aria-current={tab === key ? 'page' : undefined}>
            <span aria-hidden>{icon}</span> {label}
          </a>
        ))}
      </nav>
      {page}
      {error && <p className="error">{error}</p>}
      {confirmDialog}
    </div>
  )
}

function Head({ title, add, label }: { title: string; add: string; label: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      <a className="button primary add" href={add} aria-label={label} title={label}>+</a>
    </div>
  )
}

const NotFound = ({ back }: { back: string }) => (
  <section className="card"><p>No existe (puede que lo hayan borrado).</p><a className="link" href={back}>← Volver a la lista</a></section>
)

type ChildFields = { name: string; avatar: string; color: string }

function ChildForm({ child, onSave }: { child?: Child; onSave: (child: ChildFields) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    onSave({ name: String(f.get('name')), avatar: String(f.get('avatar')), color: String(f.get('color')) })
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>{child ? `Editar a ${child.name}` : 'Añadir niño'}</h2>
      <div className="inline">
        <EmojiPicker name="avatar" options={AVATARS} defaultValue={child?.avatar} label="Avatar" />
        <input name="name" placeholder="Nombre" required maxLength={40} defaultValue={child?.name} aria-label="Nombre" />
        <input name="color" type="color" defaultValue={child?.color || '#7c5cff'} aria-label="Color" />
        <button className="primary">{child ? 'Guardar' : 'Añadir'}</button>
        <a className="link" href={CHILDREN}>Cancelar</a>
      </div>
    </form>
  )
}

type ItemFields = { kind: string; name: string; icon: string; points: number }

function ItemForm({ item, onSave }: { item?: Item; onSave: (item: ItemFields) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    onSave({ kind: String(f.get('kind')), name: String(f.get('name')), icon: String(f.get('icon')), points: Number(f.get('points')) })
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>{item ? `Editar «${item.name}»` : 'Añadir tarea, falta o recompensa'}</h2>
      <div className="inline">
        <select name="kind" aria-label="Tipo" defaultValue={item?.kind}>
          <option value="earn">Suma</option>
          <option value="penalty">Resta</option>
          <option value="reward">Recompensa</option>
        </select>
        <EmojiPicker name="icon" options={ICONS} defaultValue={item?.icon} label="Icono" />
        <input name="name" placeholder="Hacer los deberes" required maxLength={60} defaultValue={item?.name} aria-label="Nombre" />
        <input name="points" type="number" min={1} defaultValue={item?.points ?? 10} required className="num" aria-label="Puntos" />
        <button className="primary">{item ? 'Guardar' : 'Añadir'}</button>
        <a className="link" href={ITEMS}>Cancelar</a>
      </div>
    </form>
  )
}
