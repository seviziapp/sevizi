// Sèvi Go — is direct USB thermal printing switched on for this account?
// A per-account flag (profiles.thermal_printer), set by an admin only; off for
// everyone by default. Currently enabled for Onimy Cosmetics.
import { supabase } from '../supabase';
import { hasSupabase, currentUser } from '../api/shared';
import { reportError } from '../reportError';
import { isUsbPrintingSupported } from '../escpos';

export async function fetchThermalAccess(): Promise<boolean> {
  if (!hasSupabase || !isUsbPrintingSupported()) return false; // flag is moot where WebUSB can't run
  const user = await currentUser();
  if (!user) return false;
  const { data, error } = await supabase.from('profiles').select('thermal_printer').eq('id', user.id).maybeSingle();
  if (error) { reportError(error); return false; }
  return !!data?.thermal_printer;
}
