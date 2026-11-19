import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Login } from './Login'
import { Onboarding } from './Onboarding'
import { FamilyHome } from './FamilyHome'

export default function App() {
  const [session, setSession] = useState<Session | null>()
  const [familyId, setFamilyId] = useState<string | null>()
  const userId = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    // shortcut: a user in several families sees the first one; add a family switcher if that ever happens.
    supabase.from('family_members').select('family_id').eq('user_id', userId).limit(1)
      .then(({ data }) => setFamilyId(data?.[0]?.family_id ?? null))
  }, [userId])

  if (session === undefined) return <p className="center">Cargando…</p>
  if (!session) return <Login />
  if (familyId === undefined) return <p className="center">Cargando…</p>
  if (!familyId) return <Onboarding anonymous={!!session.user.is_anonymous} onJoined={setFamilyId} />
  return <FamilyHome familyId={familyId} userId={session.user.id} />
}
