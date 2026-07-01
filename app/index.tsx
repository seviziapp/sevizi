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

      // Only select columns guaranteed to exist so this never fails and
      // wrongly re-runs onboarding.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', uid)
        .maybeSingle();

      // No profile / no role yet → pick a role
      if (!profile || !profile.role) { setDest('/onboarding/role'); return; }

      if (profile.role === 'prestataire') {
        // A provider is "set up" once their business row exists — check real
        // data, not an onboarded flag, so we never re-ask after it's saved.
        const { data: prov } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();
        setDest(prov ? '/provider/dashboard' : '/onboarding/provider-details');
        return;
      }

      // Client is set up once they have a name.
      setDest(profile.full_name ? '/client/home' : '/onboarding/client-details');
    }
    resolve();
  }, []);

  if (!dest) return null;
  return <Redirect href={dest} />;
}
