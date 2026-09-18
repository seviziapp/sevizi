-- Add "Froid & Climatisation" (refrigeration/AC) as a new service category.
alter type service_category add value if not exists 'froid';
