// Domain model for Sèvizi — matches the Supabase schema in /supabase/schema.sql

export type Role = 'client' | 'prestataire';

export type ServiceCategory =
  | 'plomberie'
  | 'electricite'
  | 'peinture'
  | 'menuiserie'
  | 'coiffure'
  | 'mecanique'
  | 'couture'
  | 'menage'
  | 'cuisine'
  | 'transport'
  | 'reparation'
  | 'cours'
  | 'jardinage'
  | 'demenagement'
  | 'securite'
  | 'photographe'
  | 'ferrailleur'
  | 'macon'
  | 'soudeur'
  | 'alu'
  | 'serigraphie'
  | 'coursier'
  | 'tapissier'
  | 'cordonnier'
  | 'onglerie'
  | 'impression'
  | 'esthetique';

// Icons live in src/lib/categoryIcons.ts (Lucide, keyed by `key`) — not here,
// so this stays a plain data list with no RN/icon imports.
export const CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: 'plomberie',    label: 'Plomberie' },
  { key: 'electricite',  label: 'Électricité' },
  { key: 'peinture',     label: 'Peinture' },
  { key: 'menuiserie',   label: 'Menuiserie' },
  { key: 'coiffure',     label: 'Coiffure' },
  { key: 'mecanique',    label: 'Mécanique' },
  { key: 'couture',      label: 'Couture' },
  { key: 'menage',       label: 'Ménage' },
  { key: 'cuisine',      label: 'Cuisine' },
  { key: 'transport',    label: 'Transport' },
  { key: 'reparation',   label: 'Réparation' },
  { key: 'cours',        label: 'Cours' },
  { key: 'jardinage',    label: 'Jardinage' },
  { key: 'demenagement', label: 'Déménagement' },
  { key: 'securite',     label: 'Sécurité / Gardiennage' },
  { key: 'photographe',  label: 'Photographie' },
  { key: 'ferrailleur',  label: 'Ferrailleur' },
  { key: 'macon',        label: 'Maçon' },
  { key: 'soudeur',      label: 'Soudeur' },
  { key: 'alu',          label: 'Alu' },
  { key: 'serigraphie',  label: 'Sérigraphie' },
  { key: 'coursier',     label: 'Coursier' },
  { key: 'tapissier',    label: 'Tapissier' },
  { key: 'cordonnier',   label: 'Cordonnier' },
  { key: 'onglerie',     label: 'Onglerie' },
  { key: 'impression',   label: 'Impression' },
  { key: 'esthetique',   label: 'Beauté & Bien-être' },
];

export type GeoPoint = { lat: number; lng: number };

export type ProviderTier = 'free' | 'pro';

export interface Provider {
  id: string;
  name: string;
  category: ServiceCategory;
  rating: number;
  reviews: number;
  verified: boolean;
  distanceKm: number;
  location: GeoPoint;
  online: boolean;
  missions?: number;
  yearsActive?: number;
  responseRate?: number;
  bio?: string;
  gallery?: string[];
  tier?: ProviderTier;
  categories?: ServiceCategory[]; // extra services a Pro provider also offers
  bookable?: boolean; // true = "Prendre rendez-vous" flow instead of "Demander un devis"
  commissionDiscountPct?: number;
  commissionDiscountUntil?: string | null;
  username?: string | null; // Pro only — powers the shareable sevizi.app/b/<username> booking link
}

export type DiscountKind = 'percent' | 'flat';
export type DiscountAppliesTo = 'commission' | 'membership' | 'both';

export interface DiscountCode {
  id: string;
  code: string;
  label?: string;
  kind: DiscountKind;
  appliesTo: DiscountAppliesTo;
  value: number;
  durationDays?: number | null;
  maxRedemptions?: number | null;
  redemptionCount: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface ProviderService {
  id: string;
  providerId: string;
  name: string;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  active: boolean;
  photoUrl?: string;
}

export type AdminActivityKind = 'service_created' | 'job_sale' | 'appointment_sale' | 'pro_sale';

export interface AdminActivityItem {
  id: string;
  kind: AdminActivityKind;
  title: string;
  subtitle: string;
  amount?: number;
  createdAt: string;
}

export interface ProviderAvailability {
  id: string;
  providerId: string;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:mm"
  endTime: string;
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type DepositStatus = 'none' | 'pending' | 'paid' | 'failed';

export interface Appointment {
  id: string;
  providerId: string;
  providerName?: string;
  clientId: string;
  clientName?: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  depositAmount: number;
  depositStatus: DepositStatus;
}

export interface ServiceRequest {
  id: string;
  clientId: string;
  description: string;
  category: ServiceCategory;
  urgent: boolean;
  location: GeoPoint;
  locationLabel: string;
  createdAt: string;
  status: 'ouverte' | 'en_cours' | 'terminee' | 'annulee';
  offersCount?: number;
  distanceKm?: number;
}

export interface Offer {
  id: string;
  requestId: string;
  provider: Provider;
  price: number;       // FCFA — "starting from" price when visitRequired
  availability: string; // e.g. "Sous 2h"
  message?: string;
  bestPrice?: boolean;
  visitRequired?: boolean; // true = an on-site visit is needed before a firm price
  priceMax?: number;       // upper end of the estimate range (visitRequired only)
}

export interface Message {
  id: string;
  threadId: string;
  fromMe: boolean;
  text?: string;
  location?: GeoPoint;
  createdAt: string;
}

export type JobStatus = 'accepte' | 'en_route' | 'arrive' | 'en_cours' | 'termine';

export interface Job {
  id: string;
  requestId: string;
  provider?: Provider;
  price: number;
  status: JobStatus;
  clientName: string;
  description?: string;
  locationLabel: string;
  location: GeoPoint;
  acceptedAt: string;
}

export interface Notification {
  id: string;
  type: 'offer' | 'accepted' | 'arrived' | 'completed' | 'review' | 'system';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  actionRoute?: string;
}

export type PaymentMethod = 'cash' | 'flooz' | 'mixx' | 'paydunya';

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ProviderStats {
  openRequests: number;
  sentOffers: number;
  completedJobs: number;
  rating: number;
  earnings: number; // FCFA this month
  responseRate: number;
}

export interface AdminStats {
  totalUsers: number;
  totalProviders: number;
  openRequests: number;
  completedToday: number;
  pendingVerifications: number;
  openDisputes: number;
  responseRate: number;
  pendingWithdrawals: number;
}

export interface VerificationRequest {
  id: string;
  displayName: string;
  type: 'client' | 'provider';
  category?: ServiceCategory;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  idDocUrl?: string;
  tradeDocUrl?: string;
  companyInfo?: string;
}

export interface Dispute {
  id: string;
  clientName: string;
  providerName: string;
  reporterName: string;
  reporterRole: 'client' | 'prestataire' | '';
  reason: string;
  createdAt: string;
  status: 'ouvert' | 'resolu';
}

// Admin's "close it out" view of an open request — includes contact info
// the client-facing ServiceRequest doesn't carry, so admin can call the
// client (or chase providers) and manually resolve stale ones by phone.
export interface AdminOpenRequest {
  id: string;
  clientName: string;
  clientPhone: string | null;
  description: string;
  category: ServiceCategory;
  urgent: boolean;
  locationLabel: string;
  createdAt: string;
  offersCount: number;
}

export interface WithdrawalRequest {
  id: string;
  providerName: string;
  amount: number;
  method: 'flooz' | 'mixx';
  phone: string;
  status: 'pending' | 'sent' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
}
