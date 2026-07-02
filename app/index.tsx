import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../src/lib/supabase';

type Dest =
  | '/client/home'
  | '/provider/dashboard'
  | '/onboarding/role'
  | '/onboarding/auth'
  | '/onboarding/client-details'
  | '/onboarding/provider-details';

export default function Index() {
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setDest('/onboarding/auth'); return; }
      const uid = session.user.id;

      // Look at real data, not just a flag, so a registered user is never sent
      // back to the welcome/role screen. Base columns only so it can't fail.
      const [{ data: profile }, { data: provs }] = await Promise.all([
        supabase.from('profiles').select('role, full_name').eq('id', uid).maybeSingle(),
        supabase.from('providers').select('id').eq('user_id', uid).limit(1),
      ]);

      // Registered provider (has a business row) → straight to dashboard.
      if (provs && provs.length > 0) { setDest('/provider/dashboard'); return; }
      // Chose provider but hasn't created the business row yet → finish that.
      if (profile?.role === 'prestataire') { setDest('/onboarding/provider-details'); return; }
      // Client who already has a name → home.
      if (profile?.full_name) { setDest('/client/home'); return; }
      // Chose client but hasn't filled details → finish that.
      if (profile?.role === 'client') { setDest('/onboarding/client-details'); return; }

      // Truly new account (no profile, no provider) → pick a role.
      setDest('/onboarding/role');
    }
    resolve();
  }, []);

  if (!dest) return null;
  return <Redirect href={dest} />;
}
