# Sèvizi — App mobile (parcours client)

Le marché des services au Togo. Demandez un service, recevez des offres, localisez le prestataire au point GPS exact.

Construit avec **Expo (React Native)** + **Supabase** (PostGIS pour les points GPS), en suivant la charte graphique v1.0 : vert Sèvizi `#0FA76A`, encre `#06291F`, crème `#FBF7EE`, typographies Hanken Grotesk + Space Mono.

## Ce qui est inclus (slice 1 — client)

| Écran | Fichier |
|---|---|
| 01 Inscription / rôle | `app/onboarding/role.tsx` |
| 02 Accueil client | `app/client/home.tsx` |
| 03 Poser une demande | `app/client/new-request.tsx` |
| 04 Carte & exploration | `app/client/map.tsx` |
| 05 Offres reçues | `app/client/offers.tsx` |
| 06 Messagerie | `app/client/thread.tsx` |
| — Profil | `app/client/profile.tsx` |

Design system dans `src/theme/tokens.ts`, composants réutilisables dans `src/components/`, couche données dans `src/lib/`.

> Le parcours **prestataire** (07–09) et le **back-office admin** (10) restent à faire — ils étaient hors périmètre de cette première tranche.

## Démarrage

```bash
npm install
npm start          # puis 'i' (iOS), 'a' (Android), ou QR code Expo Go
```

L'app **tourne directement avec des données mock** (les prestataires de Lomé des maquettes). Aucune config requise pour voir le parcours complet.

## Brancher Supabase (données réelles)

1. Créez un projet sur supabase.com.
2. SQL editor → exécutez `supabase/schema.sql` puis `supabase/seed.sql`.
3. `cp .env.example .env` et remplissez l'URL + clé anon (Settings → API).
4. Redémarrez. Dès que `EXPO_PUBLIC_SUPABASE_URL` est présent, la couche
   `src/lib/api.ts` bascule des mocks vers Supabase automatiquement.

Le point GPS est stocké en `geography(point, 4326)`. La fonction
`nearby_providers(lat, lng, cat, radius_km)` renvoie les prestataires triés
par distance — c'est le fil conducteur « localiser au point exact » de la charte.

## Notes techniques

- `react-native-maps` est natif uniquement ; sur web, la carte affiche une grille
  de substitution pour que l'écran compose quand même.
- RLS activé : un client ne voit que ses demandes ; les profils prestataires
  sont publics en lecture.
