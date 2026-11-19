import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Login } from './Login'
import { Onboarding } from './Onboarding'
import { FamilyHome } from './FamilyHome'
import { PendingFamily } from './PendingFamily'
import { AdminPanel } from './AdminPanel'
import { useRoute } from './router'

type Membership = { family_id: string; families: { name: string; status: string } | null }
const rank = (m: Membership) => ['approved', 'pending', 'rejected'].indexOf(m.families!.status)

export default function App() {
  const [session, setSession] = useState<Session | null>()
  const [family, setFamily] = useState<Membership | null>()
  const [isAdmin, setIsAdmin] = useState(false)
  const route = useRoute()
  const userId = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadFamily = useCallback(async () => {
    if (!userId) return
    // shortcut: a user in several families sees one (approved first); add a family switcher if that ever happens.
    const { data } = await supabase.from('family_members').select('family_id, families(name, status)').eq('user_id', userId)
    setFamily(data?.filter((m) => m.families).sort((a, b) => rank(a) - rank(b))[0] ?? null)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    // oxlint-disable-next-line react/set-state-in-effect -- loadFamily only sets state after awaiting the network
    loadFamily()
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data))
  }, [userId, loadFamily])

  if (session === undefined) return <p className="center">Cargando…</p>
  if (!session) return <Login />
  if (route[0] === 'admin' && isAdmin) return <AdminPanel />
  if (family === undefined) return <p className="center">Cargando…</p>

  const status = family?.families?.status
  if (family && status === 'pending') {
    return <PendingFamily familyId={family.family_id} name={family.families!.name} onChange={loadFamily} />
  }
  if (!family || status !== 'approved') {
    return (
      <Onboarding
        anonymous={!!session.user.is_anonymous}
        isAdmin={isAdmin}
        rejected={status === 'rejected' ? family?.families?.name : undefined}
        onJoined={loadFamily}
      />
    )
  }
  return <FamilyHome familyId={family.family_id} userId={session.user.id} isAdmin={isAdmin} />
}
