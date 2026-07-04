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
  | 'cours';

export const CATEGORIES: { key: ServiceCategory; label: string; emoji: string }[] = [
  { key: 'plomberie',   label: 'Plomberie',    emoji: '🔧' },
  { key: 'electricite', label: 'Électricité',  emoji: '⚡' },
  { key: 'peinture',    label: 'Peinture',     emoji: '🖌️' },
  { key: 'menuiserie',  label: 'Menuiserie',   emoji: '🪚' },
  { key: 'coiffure',    label: 'Coiffure',     emoji: '✂️' },
  { key: 'mecanique',   label: 'Mécanique',    emoji: '🔩' },
  { key: 'couture',     label: 'Couture',      emoji: '🧵' },
  { key: 'menage',      label: 'Ménage',       emoji: '🧹' },
  { key: 'cuisine',     label: 'Cuisine',      emoji: '🍳' },
  { key: 'transport',   label: 'Transport',    emoji: '🚗' },
  { key: 'reparation',  label: 'Réparation',   emoji: '🛠️' },
  { key: 'cours',       label: 'Cours',        emoji: '📚' },
];

export type GeoPoint = { lat: number; lng: number };

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
  price: number;       // FCFA
  availability: string; // e.g. "Sous 2h"
  message?: string;
  bestPrice?: boolean;
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

export type PaymentMethod = 'cash' | 'flooz' | 'mixx';

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
