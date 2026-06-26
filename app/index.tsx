import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecked(true);
    });
  }, []);

  if (!checked) return null;
  if (authed) return <Redirect href="/client/home" />;
  return <Redirect href="/onboarding/auth" />;
}
