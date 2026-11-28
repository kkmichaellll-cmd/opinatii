begin;
alter table public.op_photos add column if not exists link_url text
  check (length(link_url) <= 2048 and link_url ~* '^https?://[^/[:space:]]+' and link_url !~ '[[:space:]]');

-- Seed only on first creation, so reruns preserve edits and deletions.
with hero as (
  insert into public.op_categories (id, name)
  values ('f36e184c-5c9c-4a1e-a48d-fef40cde801e', '__opinatii_homepage_hero__')
  on conflict (id) do nothing returning id
)
insert into public.op_photos (category_id, original, label, published)
select hero.id, slide.original, slide.label, true
from hero cross join (values
  (1, 'love', 'A joyful embrace between a bride and her partner'),
  (2, 'bride', 'Bride in a burgundy dress and gele'),
  (3, 'couple', 'Couple in coordinated blue traditional wedding attire'),
  (4, 'wedding', 'Bride and groom in white wedding attire'),
  (5, 'wedding', 'Bride in a white gown beside her seated partner'),
  (6, 'footer-wedding-0', 'Couple in burgundy traditional wedding attire'),
  (7, 'kiss', 'Couple sharing a kiss in a sunlit arched doorway')
) as slide(position, original, label) order by slide.position;
commit;
