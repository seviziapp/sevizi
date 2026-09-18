// Sèvizi — super admin creates a brand-new admin account.
// Always a fresh auth.users row with its own email + temporary password —
// never reuses or upgrades an existing client/prestataire account, so an
// account is either a normal user or an admin, never both (see
// migration_admin_hierarchy.sql for the DB-side exclusivity enforcement).
// Only a caller whose own profile has is_super_admin = true may call this;
// checked here with the service-role client (bypasses RLS) since the
// caller's own read of their profile could otherwise be tampered with
// client-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non connecté');

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await caller.auth.getUser();
    if (callerErr || !callerUser) throw new Error('Non connecté');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from('profiles').select('is_super_admin').eq('id', callerUser.id).single();
    if (!callerProfile?.is_super_admin) throw new Error('Réservé aux super admins.');

    const { email, fullName, temporaryPassword } = await req.json().catch(() => ({} as any));
    if (!email || !fullName || !temporaryPassword) {
      throw new Error('Email, nom et mot de passe temporaire requis.');
    }
    if (String(temporaryPassword).length < 8) {
      throw new Error('Le mot de passe temporaire doit faire au moins 8 caractères.');
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (createErr) throw createErr;
    const newUserId = created.user.id;

    const { error: profileErr } = await admin.from('profiles').upsert({
      id: newUserId,
      email,
      full_name: fullName,
      role: 'client', // irrelevant for an admin account — never used, see the
      // exclusivity triggers that block this row from ever becoming a
      // provider or posting a request.
      onboarded: true,
      is_admin: true,
      is_super_admin: false,
      force_password_change: true,
    });
    if (profileErr) {
      // Roll back the auth user so a failed insert doesn't leave an orphaned
      // login with no matching profile.
      await admin.auth.admin.deleteUser(newUserId);
      throw profileErr;
    }

    return new Response(JSON.stringify({ ok: true, id: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
