import { useState, type FormEvent, type ReactNode } from 'react'
import { errorText, supabase } from './lib/supabase'
import { itemValue, signed, type Child, type FamilyData, type Item, type Kind } from './useFamily'
import { EmojiPicker } from './EmojiPicker'
import { AVATARS, ICONS } from './emojis'
import { go } from './router'
import { useConfirm } from './useConfirm'
import { useT } from './i18n'

// route: the path after #/parents, e.g. [] | ['items'] | ['items', 'new'] | ['items', <id>]
type Props = { data: FamilyData; userId: string; reload: () => void; route: string[] }

const tabs = [['children', '🧒'], ['items', '⭐'], ['members', '👨‍👩‍👧'], ['code', '🔑']] as const
const CHILDREN = '#/parents/children'
const ITEMS = '#/parents/items'

export function ParentPanel({ data, userId, reload, route }: Props) {
  const t = useT()
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
        <Head title={t.parents.childrenTitle} add={`${CHILDREN}/new`} label={t.parents.addChild} />
        <ul className="rows">
          {data.children.map((c) => (
            <li key={c.id}>
              <span className="avatar">{c.avatar || '🙂'}</span>
              <span className="grow">{c.name}</span>
              <a className="link" href={`${CHILDREN}/${c.id}`}>{t.common.edit}</a>
              <button className="link danger" onClick={async () =>
                await confirm({ icon: c.avatar || '🙂', title: t.parents.deleteChildTitle(c.name), message: t.parents.deleteChildMessage, confirmLabel: t.common.delete, danger: true }) &&
                run(supabase.from('children').delete().eq('id', c.id))
              }>{t.common.delete}</button>
            </li>
          ))}
        </ul>
        {data.children.length === 0 && <p>{t.parents.noChildren}</p>}
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
        <Head title={t.parents.itemsTitle} add={`${ITEMS}/new`} label={t.parents.addItem} />
        {(['earn', 'penalty', 'reward'] as Kind[]).map((kind) => (
          <div key={kind}>
            <h3>{t.parents.groups[kind]}</h3>
            <ul className="rows">
              {data.items.filter((i) => i.kind === kind).map((i) => (
                <li key={i.id}>
                  <span className="avatar">{i.icon}</span>
                  <span className="grow">{i.name}</span>
                  <b>{signed(itemValue(i))}</b>
                  <a className="link" href={`${ITEMS}/${i.id}`}>{t.common.edit}</a>
                  {/* archived, not deleted: the history keeps pointing at it */}
                  <button className="link danger" onClick={() => run(supabase.from('items').update({ archived: true }).eq('id', i.id))}>{t.common.remove}</button>
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
        <h2>{t.parents.membersTitle}</h2>
        <ul className="rows">
          {data.members.map((m) => (
            <li key={m.user_id}>
              <span className="grow">{m.name}{m.user_id === userId && t.parents.you}</span>
              <span className="tag">{m.role === 'parent' ? t.parents.roleParent : t.parents.roleChild}</span>
              {m.user_id !== userId && (
                <>
                  <button className="link" onClick={() =>
                    run(supabase.from('family_members').update({ role: m.role === 'parent' ? 'child' : 'parent' })
                      .eq('family_id', familyId).eq('user_id', m.user_id))
                  }>{m.role === 'parent' ? t.parents.makeChild : t.parents.makeParent}</button>
                  <button className="link danger" onClick={async () =>
                    await confirm({ icon: '👋', title: t.parents.removeMemberTitle(m.name), message: t.parents.removeMemberMessage, confirmLabel: t.common.remove, danger: true }) &&
                    run(supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', m.user_id))
                  }>{t.common.remove}</button>
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
        <h2>{t.parents.codeTitle}</h2>
        <p className="code">{data.family.invite_code}</p>
        <p>{t.parents.codeHelp}</p>
      </section>
    )
  }

  return (
    <div className="panel">
      <nav className="tabs" aria-label={t.parents.nav}>
        {tabs.map(([key, icon]) => (
          <a key={key} href={`#/parents/${key}`} aria-current={tab === key ? 'page' : undefined}>
            <span aria-hidden>{icon}</span> {t.parents.tabs[key]}
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

function NotFound({ back }: { back: string }) {
  const t = useT()
  return <section className="card"><p>{t.parents.notFound}</p><a className="link" href={back}>{t.parents.backToList}</a></section>
}

type ChildFields = { name: string; avatar: string; color: string }

function ChildForm({ child, onSave }: { child?: Child; onSave: (child: ChildFields) => void }) {
  const t = useT()
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    onSave({ name: String(f.get('name')), avatar: String(f.get('avatar')), color: String(f.get('color')) })
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>{child ? t.parents.editChild(child.name) : t.parents.addChild}</h2>
      <div className="inline">
        <EmojiPicker name="avatar" options={AVATARS} defaultValue={child?.avatar} label={t.parents.avatar} />
        <input name="name" placeholder={t.parents.name} required maxLength={40} defaultValue={child?.name} aria-label={t.parents.name} />
        <input name="color" type="color" defaultValue={child?.color || '#7c5cff'} aria-label={t.parents.color} />
        <button className="primary">{child ? t.common.save : t.common.add}</button>
        <a className="link" href={CHILDREN}>{t.common.cancel}</a>
      </div>
    </form>
  )
}

type ItemFields = { kind: string; name: string; icon: string; points: number }

function ItemForm({ item, onSave }: { item?: Item; onSave: (item: ItemFields) => void }) {
  const t = useT()
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    onSave({ kind: String(f.get('kind')), name: String(f.get('name')), icon: String(f.get('icon')), points: Number(f.get('points')) })
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>{item ? t.parents.editItem(item.name) : t.parents.addItem}</h2>
      <div className="inline">
        <select name="kind" aria-label={t.parents.kind} defaultValue={item?.kind}>
          {(['earn', 'penalty', 'reward'] as const).map((k) => <option key={k} value={k}>{t.parents.kinds[k]}</option>)}
        </select>
        <EmojiPicker name="icon" options={ICONS} defaultValue={item?.icon} label={t.parents.icon} />
        <input name="name" placeholder={t.parents.itemPlaceholder} required maxLength={60} defaultValue={item?.name} aria-label={t.parents.name} />
        <input name="points" type="number" min={1} defaultValue={item?.points ?? 10} required className="num" aria-label={t.parents.points} />
        <button className="primary">{item ? t.common.save : t.common.add}</button>
        <a className="link" href={ITEMS}>{t.common.cancel}</a>
      </div>
    </form>
  )
}
