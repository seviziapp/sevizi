// Sèvizi — admin deletes a marketplace user's account (client or
// prestataire). Same underlying operation as the self-service delete-account
// function (deletes the auth.users row; migration_account_deletion.sql
// documents exactly what cascades vs. gets nulled out), just admin-initiated
// for a target user instead of the caller's own account.
//
// Deliberately refuses to touch an admin account — that's a super-admin-only
// action (admin-set-role's "revoke"), not a generic user-management one, so
// this never becomes a side door around that gate.
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
      .from('profiles').select('is_admin').eq('id', callerUser.id).single();
    if (!callerProfile?.is_admin) throw new Error('Réservé aux administrateurs.');

    const { targetId } = await req.json().catch(() => ({} as any));
    if (!targetId) throw new Error('Utilisateur cible requis.');
    if (targetId === callerUser.id) throw new Error('Vous ne pouvez pas supprimer votre propre compte ici.');

    const { data: targetProfile } = await admin
      .from('profiles').select('is_admin').eq('id', targetId).single();
    if (targetProfile?.is_admin) {
      throw new Error('Utilisez l\'écran Équipe admin pour un compte administrateur.');
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) throw delErr;

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
