// Sèvizi — shared state/helpers used across every api/* domain module:
// the demo-mode flag, session resolution, the Lomé anchor point, and the
// mock data returned when no Supabase project is configured. Extracted
// from the former monolithic api.ts (Phase 1 of the architecture cleanup)
// with behavior unchanged — every function here is a verbatim move.
import { supabase } from '../supabase';
import {
  Provider, ServiceRequest, Offer, Job, Notification, GeoPoint,
  ProviderStats, AdminStats, VerificationRequest, Dispute, Review,
} from '../types';

export const LOME: GeoPoint = { lat: 6.1719, lng: 1.2310 };

export const hasSupabase = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

// Resolve the signed-in user reliably. getSession() reads the locally persisted
// session (and refreshes it if needed) without a network round-trip, so it works
// even right after an OAuth redirect or page reload — unlike getUser(), which can
// transiently return null and surface as a spurious "Non connecté".
export async function currentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const fallback = await supabase.auth.getUser();
  return fallback.data.user ?? null;
}

// Priority placement is a Sèvizi Pro perk — Pro providers rank first, then by
// distance. The RPC already orders this way; this keeps the fallback/mock
// paths consistent (Array#sort is stable, so distance order within a tier
// group is preserved).
export function byTierThenDistance(a: Provider, b: Provider) {
  const proA = a.tier === 'pro' ? 1 : 0;
  const proB = b.tier === 'pro' ? 1 : 0;
  return proB - proA;
}

// ---- Mock data ----

export const mockProviders: Provider[] = [
  { id: 'p1', name: 'Kossi Plomberie', category: 'plomberie', rating: 4.8, reviews: 128, verified: true, distanceKm: 0.8, location: { lat: 6.1735, lng: 1.2322 }, online: true, missions: 214, yearsActive: 5, responseRate: 96, bio: 'Plombier professionnel basé à Lomé depuis 2019. Disponible 7j/7.' },
  { id: 'p2', name: 'AquaFix Togo', category: 'plomberie', rating: 4.6, reviews: 74, verified: true, distanceKm: 1.4, location: { lat: 6.1702, lng: 1.2290 }, online: true, missions: 148, yearsActive: 3, responseRate: 88 },
  { id: 'p3', name: 'Mawunyo Services', category: 'plomberie', rating: 4.3, reviews: 41, verified: false, distanceKm: 2.1, location: { lat: 6.1688, lng: 1.2345 }, online: false, missions: 67, yearsActive: 2, responseRate: 72 },
  { id: 'p4', name: 'Élec Express', category: 'electricite', rating: 4.5, reviews: 58, verified: true, distanceKm: 1.5, location: { lat: 6.1750, lng: 1.2280 }, online: true, missions: 102, yearsActive: 4, responseRate: 91 },
  { id: 'p5', name: 'Salon Afi', category: 'coiffure', rating: 4.9, reviews: 203, verified: true, distanceKm: 0.5, location: { lat: 6.1722, lng: 1.2305 }, online: true, missions: 380, yearsActive: 6, responseRate: 98 },
  { id: 'p6', name: 'Transport Koffi', category: 'transport', rating: 4.4, reviews: 89, verified: true, distanceKm: 1.1, location: { lat: 6.1745, lng: 1.2295 }, online: true, missions: 175, yearsActive: 3, responseRate: 85 },
];

export const mockRequests: ServiceRequest[] = [
  { id: 'r1', clientId: 'me', description: 'Fuite sous l\'évier de la cuisine, besoin d\'un plombier aujourd\'hui.', category: 'plomberie', urgent: true, location: { lat: 6.1720, lng: 1.2315 }, locationLabel: 'Bè-Kpota, Lomé', createdAt: new Date().toISOString(), status: 'ouverte', offersCount: 3 },
  { id: 'r2', clientId: 'me', description: 'Prise de courant qui ne fonctionne plus dans le salon.', category: 'electricite', urgent: false, location: { lat: 6.1730, lng: 1.2300 }, locationLabel: 'Tokoin, Lomé', createdAt: new Date(Date.now() - 3600000).toISOString(), status: 'ouverte', offersCount: 1 },
  { id: 'r3', clientId: 'c2', description: 'Tuyau cassé dans la salle de bain.', category: 'plomberie', urgent: true, location: { lat: 6.1705, lng: 1.2330 }, locationLabel: 'Adidogomé, Lomé', createdAt: new Date(Date.now() - 1800000).toISOString(), status: 'ouverte', offersCount: 0 },
  { id: 'r4', clientId: 'c3', description: 'Peinture salon 3 pièces, environ 45m².', category: 'peinture', urgent: false, location: { lat: 6.1760, lng: 1.2280 }, locationLabel: 'Hédzranawoé, Lomé', createdAt: new Date(Date.now() - 7200000).toISOString(), status: 'ouverte', offersCount: 2 },
];

export const mockOffers: Offer[] = [
  { id: 'o1', requestId: 'r1', provider: mockProviders[0], price: 4500, availability: 'Sous 2h', message: 'Je peux passer dans 2h, je règle ça aujourd\'hui.', bestPrice: true },
  { id: 'o2', requestId: 'r1', provider: mockProviders[1], price: 5000, availability: 'Aujourd\'hui' },
  { id: 'o3', requestId: 'r1', provider: mockProviders[2], price: 6200, availability: 'Demain', message: 'Je serai disponible demain matin.' },
];

export const mockJobs: Job[] = [
  { id: 'j1', requestId: 'r5', provider: mockProviders[0], price: 4500, status: 'en_route', clientName: 'Ama Doe', locationLabel: 'Bè-Kpota, Lomé', location: { lat: 6.1720, lng: 1.2315 }, acceptedAt: new Date().toISOString() },
];

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'offer', title: '3 offres reçues', body: 'Kossi Plomberie et 2 autres ont répondu à votre demande.', read: false, createdAt: new Date(Date.now() - 300000).toISOString(), actionRoute: '/client/offers' },
  { id: 'n2', type: 'arrived', title: 'Prestataire arrivé', body: 'Kossi Plomberie est arrivé à votre adresse.', read: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
  { id: 'n3', type: 'completed', title: 'Mission terminée', body: 'Votre mission Électricité est terminée. Donnez votre avis !', read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n4', type: 'system', title: 'Bienvenue sur Sèvizi', body: 'Votre compte a été créé avec succès.', read: true, createdAt: new Date(Date.now() - 172800000).toISOString() },
];

export const mockProviderStats: ProviderStats = {
  openRequests: 4,
  sentOffers: 2,
  completedJobs: 214,
  rating: 4.8,
  earnings: 127500,
  responseRate: 96,
};

export const mockAdminStats: AdminStats = {
  totalUsers: 1842,
  totalProviders: 318,
  openRequests: 47,
  completedToday: 23,
  pendingVerifications: 12,
  openDisputes: 5,
  responseRate: 84,
  pendingWithdrawals: 3,
};

export const mockVerifications: VerificationRequest[] = [
  { id: 'v1', providerName: 'Jean Agbayissa', category: 'electricite', submittedAt: new Date(Date.now() - 3600000).toISOString(), status: 'pending' },
  { id: 'v2', providerName: 'Abla Mensah', category: 'coiffure', submittedAt: new Date(Date.now() - 7200000).toISOString(), status: 'pending' },
  { id: 'v3', providerName: 'Kofi Transport', category: 'transport', submittedAt: new Date(Date.now() - 10800000).toISOString(), status: 'pending' },
  { id: 'v4', providerName: 'Senu Réparations', category: 'reparation', submittedAt: new Date(Date.now() - 86400000).toISOString(), status: 'approved' },
];

export const mockDisputes: Dispute[] = [
  { id: 'd1', clientName: 'Ama Doe', providerName: 'Mawunyo Services', reason: 'Travail non conforme à l\'accord', createdAt: new Date(Date.now() - 3600000).toISOString(), status: 'ouvert' },
  { id: 'd2', clientName: 'Kosi Atta', providerName: 'AquaFix Togo', reason: 'Prestataire ne s\'est pas présenté', createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'ouvert' },
  { id: 'd3', clientName: 'Yawa Nkrumah', providerName: 'Élec Express', reason: 'Prix différent du devis', createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'resolu' },
];

export const mockReviews: Review[] = [
  { id: 'rv1', authorName: 'Ama D.', rating: 5, comment: 'Travail impeccable, très rapide !', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'rv2', authorName: 'Kosi A.', rating: 5, comment: 'Professionnel et ponctuel.', createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'rv3', authorName: 'Yawa N.', rating: 4, comment: 'Bon travail, petit retard mais expliqué.', createdAt: new Date(Date.now() - 259200000).toISOString() },
];
