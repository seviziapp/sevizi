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

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, onboarded')
        .eq('id', session.user.id)
        .single();

      // No profile yet → pick a role
      if (!profile || !profile.role) { setDest('/onboarding/role'); return; }

      // Role chosen but signup details not completed → finish the right form
      if (!profile.onboarded) {
        setDest(profile.role === 'prestataire' ? '/onboarding/provider-details' : '/onboarding/client-details');
        return;
      }

      // Fully set up
      setDest(profile.role === 'prestataire' ? '/provider/dashboard' : '/client/home');
    }
    resolve();
  }, []);

  if (!dest) return null;
  return <Redirect href={dest} />;
}
