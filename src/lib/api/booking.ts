// Sèvizi — appointment booking API (Beauty & Wellness): the bookable flag,
// service menu, weekly availability, slot generation, and appointments
// themselves. Split out of the former monolithic api.ts (Phase 1); every
// function body is unchanged.
import { supabase } from '../supabase';
import { ProviderService, ProviderAvailability, Appointment } from '../types';
import { hasSupabase, currentUser } from './shared';

// Any provider can flip this on to switch their profile from "Demander un
// devis" to "Prendre rendez-vous" — no payment gating, just a UI mode switch.
export async function toggleBookable(bookable: boolean): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { error } = await supabase.from('providers').update({ bookable }).eq('user_id', user.id);
  if (error) throw error;
}

export async function fetchProviderServices(providerId: string): Promise<ProviderService[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('provider_services').select('*').eq('provider_id', providerId).eq('active', true)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((s: any) => ({
    id: s.id, providerId: s.provider_id, name: s.name,
    durationMinutes: s.duration_minutes, price: s.price,
    depositAmount: s.deposit_amount ?? 0, active: !!s.active,
    photoUrl: s.photo_url ?? undefined,
  }));
}

// Current provider's own service menu (including inactive, so they can
// reactivate one instead of retyping it).
export async function fetchMyServices(): Promise<ProviderService[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) return [];
  const { data, error } = await supabase
    .from('provider_services').select('*').eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((s: any) => ({
    id: s.id, providerId: s.provider_id, name: s.name,
    durationMinutes: s.duration_minutes, price: s.price,
    depositAmount: s.deposit_amount ?? 0, active: !!s.active,
    photoUrl: s.photo_url ?? undefined,
  }));
}

export async function saveService(input: { id?: string; name: string; durationMinutes: number; price: number; depositAmount: number; photoUrl?: string }): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) throw new Error('Profil prestataire introuvable');
  if (input.id) {
    const { error } = await supabase.from('provider_services').update({
      name: input.name, duration_minutes: input.durationMinutes,
      price: input.price, deposit_amount: input.depositAmount,
      photo_url: input.photoUrl ?? null,
    }).eq('id', input.id).eq('provider_id', providerId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('provider_services').insert({
      provider_id: providerId, name: input.name, duration_minutes: input.durationMinutes,
      price: input.price, deposit_amount: input.depositAmount,
      photo_url: input.photoUrl ?? null,
    });
    if (error) throw error;
  }
}

export async function deleteService(id: string): Promise<void> {
  if (!hasSupabase) return;
  // Soft-delete: past/future appointments keep their denormalized service_name
  // even if the service is later removed from the menu.
  const { error } = await supabase.from('provider_services').update({ active: false }).eq('id', id);
  if (error) throw error;
}

export async function fetchProviderAvailability(providerId: string): Promise<ProviderAvailability[]> {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('provider_availability').select('*').eq('provider_id', providerId).order('day_of_week');
  if (error) return [];
  return (data ?? []).map((a: any) => ({
    id: a.id, providerId: a.provider_id, dayOfWeek: a.day_of_week,
    startTime: a.start_time?.slice(0, 5) ?? '09:00', endTime: a.end_time?.slice(0, 5) ?? '18:00',
  }));
}

export async function fetchMyAvailability(): Promise<ProviderAvailability[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) return [];
  return fetchProviderAvailability(providerId);
}

// Replaces the provider's whole weekly schedule with the given slots (simplest
// consistent model for a "set your hours" screen — no partial patches).
export async function saveMyAvailability(slots: { dayOfWeek: number; startTime: string; endTime: string }[]): Promise<void> {
  if (!hasSupabase) return;
  const user = await currentUser();
  if (!user) throw new Error('Non connecté');
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) throw new Error('Profil prestataire introuvable');
  await supabase.from('provider_availability').delete().eq('provider_id', providerId);
  if (slots.length === 0) return;
  const { error } = await supabase.from('provider_availability').insert(
    slots.map(s => ({ provider_id: providerId, day_of_week: s.dayOfWeek, start_time: s.startTime, end_time: s.endTime }))
  );
  if (error) throw error;
}

// Free time slots for a given service on a given calendar day, computed from
// the provider's weekly hours minus already-booked (non-cancelled)
// appointments. `date` is a local "YYYY-MM-DD" string.
export async function fetchAvailableSlots(providerId: string, service: ProviderService, date: string): Promise<string[]> {
  if (!hasSupabase) return [];
  const day = new Date(`${date}T00:00:00`);
  const dayOfWeek = day.getDay();

  const { data: hours } = await supabase
    .from('provider_availability').select('start_time, end_time')
    .eq('provider_id', providerId).eq('day_of_week', dayOfWeek);
  if (!hours || hours.length === 0) return [];

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
  const { data: existing } = await supabase
    .from('appointments').select('starts_at, ends_at')
    .eq('provider_id', providerId).neq('status', 'cancelled')
    .gte('starts_at', dayStart.toISOString()).lte('starts_at', dayEnd.toISOString());
  const busy = (existing ?? []).map((a: any) => ({ start: new Date(a.starts_at).getTime(), end: new Date(a.ends_at).getTime() }));

  const durationMs = service.durationMinutes * 60000;
  const stepMinutes = 15;
  const slots: string[] = [];
  const now = Date.now();

  for (const h of hours) {
    const [sh, sm] = h.start_time.slice(0, 5).split(':').map(Number);
    const [eh, em] = h.end_time.slice(0, 5).split(':').map(Number);
    let cursor = new Date(date + 'T00:00:00');
    cursor.setHours(sh, sm, 0, 0);
    const windowEnd = new Date(date + 'T00:00:00');
    windowEnd.setHours(eh, em, 0, 0);

    while (cursor.getTime() + durationMs <= windowEnd.getTime()) {
      const slotStart = cursor.getTime();
      const slotEnd = slotStart + durationMs;
      const overlaps = busy.some(b => slotStart < b.end && slotEnd > b.start);
      if (!overlaps && slotStart > now) slots.push(new Date(slotStart).toISOString());
      cursor = new Date(cursor.getTime() + stepMinutes * 60000);
    }
  }
  return slots;
}

// Books a slot. For a zero-deposit service the appointment is confirmed
// immediately (no invoiceUrl returned); otherwise open invoiceUrl for the
// client to pay the deposit via PayDunya.
export async function createAppointmentInvoice(input: { serviceId: string; startsAt: string; returnUrl: string; cancelUrl: string }): Promise<{ appointmentId: string; invoiceUrl?: string; confirmed?: boolean }> {
  if (!hasSupabase) throw new Error('Réservation indisponible en mode démo');
  const { data, error } = await supabase.functions.invoke('paydunya-create-appointment-invoice', {
    body: input,
  });
  if (error) {
    const context = (error as any)?.context;
    let bodyMessage: string | undefined;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json();
        bodyMessage = body?.error;
      } catch { /* body wasn't JSON — fall through to the generic error */ }
    }
    throw new Error(bodyMessage ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchAppointmentDepositStatus(appointmentId: string): Promise<Appointment['depositStatus']> {
  if (!hasSupabase) return 'none';
  const { data } = await supabase.from('appointments').select('deposit_status').eq('id', appointmentId).single();
  return (data?.deposit_status as any) ?? 'none';
}

function mapAppointment(a: any): Appointment {
  return {
    id: a.id, providerId: a.provider_id, providerName: a.provider?.name,
    clientId: a.client_id, clientName: a.client_name,
    serviceName: a.service_name, price: a.price, durationMinutes: a.duration_minutes,
    startsAt: a.starts_at, endsAt: a.ends_at, status: a.status,
    depositAmount: a.deposit_amount ?? 0, depositStatus: a.deposit_status ?? 'none',
  };
}

// Client's own appointments — upcoming first, most recent first within group.
export async function fetchMyAppointments(): Promise<Appointment[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('appointments').select('*, provider:providers(name)')
    .eq('client_id', user.id).order('starts_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(mapAppointment);
}

// Provider's own appointments for their agenda view.
export async function fetchProviderAppointments(): Promise<Appointment[]> {
  if (!hasSupabase) return [];
  const user = await currentUser();
  if (!user) return [];
  const { data: providerRows } = await supabase.from('providers').select('id').eq('user_id', user.id).limit(1);
  const providerId = providerRows?.[0]?.id;
  if (!providerId) return [];
  const { data, error } = await supabase
    .from('appointments').select('*, client:profiles(full_name)')
    .eq('provider_id', providerId).neq('status', 'cancelled').order('starts_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map((a: any) => ({ ...mapAppointment(a), clientName: a.client?.full_name ?? 'Client' }));
}

export async function cancelAppointment(id: string): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw error;
}

export async function markAppointmentStatus(id: string, status: 'completed' | 'no_show'): Promise<void> {
  if (!hasSupabase) return;
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
}
