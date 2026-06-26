-- Sèvizi — seed data (Lomé providers)
insert into providers (name, category, bio, rating, reviews, missions, years_active, response_rate, verified, online, geo) values
  ('Kossi Plomberie',  'plomberie',  'Plombier professionnel depuis 2019. Disponible 7j/7.', 4.8, 128, 214, 5, 96, true,  true,  st_setsrid(st_makepoint(1.2322, 6.1735),4326)),
  ('AquaFix Togo',     'plomberie',  'Spécialiste installation et réparation.', 4.6, 74, 148, 3, 88, true,  true,  st_setsrid(st_makepoint(1.2290, 6.1702),4326)),
  ('Mawunyo Services', 'plomberie',  null, 4.3, 41, 67, 2, 72, false, false, st_setsrid(st_makepoint(1.2345, 6.1688),4326)),
  ('Élec Express',     'electricite','Électricien agréé, dépannages rapides.', 4.5, 58, 102, 4, 91, true,  true,  st_setsrid(st_makepoint(1.2280, 6.1750),4326)),
  ('Salon Afi',        'coiffure',   'Coiffeuse professionnelle, domicile ou salon.', 4.9, 203, 380, 6, 98, true,  true,  st_setsrid(st_makepoint(1.2305, 6.1722),4326)),
  ('Transport Koffi',  'transport',  'Chauffeur pour courses et livraisons.', 4.4, 89, 175, 3, 85, true,  true,  st_setsrid(st_makepoint(1.2295, 6.1745),4326)),
  ('Mensah Menuiserie','menuiserie', null, 4.4, 33, 55, 2, 76, false, false, st_setsrid(st_makepoint(1.2355, 6.1709),4326));
