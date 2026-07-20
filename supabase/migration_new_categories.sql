-- Sèvizi — Add new service categories
-- Run in Supabase → SQL Editor (idempotent).
--
-- Includes 4 categories that were already shown as browsable tiles on the
-- client "Toutes les catégories" screen (jardinage, demenagement, securite,
-- photographe) but were never real category values — tapping them silently
-- fell back to "plomberie" on the request form. Promoting them to real
-- categories here fixes that, alongside the 10 new services requested.

alter type service_category add value if not exists 'jardinage';
alter type service_category add value if not exists 'demenagement';
alter type service_category add value if not exists 'securite';
alter type service_category add value if not exists 'photographe';
alter type service_category add value if not exists 'ferrailleur';
alter type service_category add value if not exists 'macon';
alter type service_category add value if not exists 'soudeur';
alter type service_category add value if not exists 'alu';
alter type service_category add value if not exists 'serigraphie';
alter type service_category add value if not exists 'coursier';
alter type service_category add value if not exists 'tapissier';
alter type service_category add value if not exists 'cordonnier';
alter type service_category add value if not exists 'onglerie';
alter type service_category add value if not exists 'impression';
alter type service_category add value if not exists 'esthetique';
