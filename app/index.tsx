import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { isSevigoHost } from '../src/lib/brand';
import { supabase } from '../src/lib/supabase';

type Dest =
  | '/client/home'
  | '/provider/dashboard'
  | '/onboarding/role'
  | '/onboarding/auth'
  | '/onboarding/client-details'
  | '/onboarding/provider-details'
  | '/admin/dashboard'
  | '/go'
  | '/sevigo/dashboard';

// Sèvi Go has its own front door (go.sevizi.app, see src/lib/brand.ts): visitors
// there see the Sèvi Go landing page and land on Sèvi Go after sign-in, never on
// the marketplace screens.

export default function Index() {
  const [dest, setDest] = useState<Dest | null>(null);

  useEffect(() => {
    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession();
      const goHost = isSevigoHost();
      if (!session) { setDest(goHost ? '/go' : '/onboarding/auth'); return; }
      const uid = session.user.id;

      // Look at real data, not just a flag, so a registered user is never sent
      // back to the welcome/role screen. Base columns only so it can't fail.
      const [{ data: profile }, { data: provs }] = await Promise.all([
        supabase.from('profiles').select('role, full_name, is_admin').eq('id', uid).maybeSingle(),
        supabase.from('providers').select('id').eq('user_id', uid).limit(1),
      ]);

      // Admin accounts are exclusive — never a client/provider home, always
      // the back-office (which itself gates on is_admin again).
      if (profile?.is_admin) { setDest('/admin/dashboard'); return; }
      // Sèvi Go door: any account goes to Sèvi Go. A brand-new account gets a
      // bare profile (no marketplace onboarding); it can't post requests while
      // clients are closed, which the database enforces.
      if (goHost) {
        if (!profile) {
          await supabase.from('profiles').upsert({ id: uid, role: 'client', email: session.user.email ?? null, onboarded: false });
        }
        setDest('/sevigo/dashboard');
        return;
      }
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
  return <Redirect href={dest as any} />;
}
