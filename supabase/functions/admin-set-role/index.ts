// Sèvizi — super admin manages an existing admin's standing: promote to
// super admin, demote back to plain admin, or revoke admin access entirely
// (deletes the login outright — an admin account has no other purpose, see
// admin-create-admin). Super-admin-only, same gate pattern as
// admin-create-admin. A super admin cannot revoke or demote their own
// account, so the team can never be left with zero super admins by mistake.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'promote' | 'demote' | 'revoke';

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

    const { targetId, action } = await req.json().catch(() => ({} as any));
    if (!targetId || !['promote', 'demote', 'revoke'].includes(action)) {
      throw new Error('Requête invalide.');
    }
    if (targetId === callerUser.id) {
      throw new Error('Vous ne pouvez pas modifier votre propre compte ici.');
    }

    const act = action as Action;
    if (act === 'revoke') {
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) throw error;
    } else {
      const { error } = await admin.from('profiles')
        .update({ is_super_admin: act === 'promote' })
        .eq('id', targetId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
