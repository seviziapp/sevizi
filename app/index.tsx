import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../src/lib/supabase';

type Dest = '/client/home' | '/provider/dashboard' | '/onboarding/role' | '/onboarding/auth';

export default function Index() {
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setDest('/onboarding/auth'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile) { setDest('/onboarding/role'); return; }
      setDest(profile.role === 'prestataire' ? '/provider/dashboard' : '/client/home');
    }
    resolve();
  }, []);

  if (!dest) return null;
  return <Redirect href={dest} />;
}
