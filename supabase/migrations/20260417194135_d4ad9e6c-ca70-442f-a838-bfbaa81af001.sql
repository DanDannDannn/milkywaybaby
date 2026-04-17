-- Cascade-delete child rows when a baby is deleted
ALTER TABLE public.feedings DROP CONSTRAINT IF EXISTS feedings_baby_id_fkey;
ALTER TABLE public.feedings ADD CONSTRAINT feedings_baby_id_fkey
  FOREIGN KEY (baby_id) REFERENCES public.babies(id) ON DELETE CASCADE;

ALTER TABLE public.diapers DROP CONSTRAINT IF EXISTS diapers_baby_id_fkey;
ALTER TABLE public.diapers ADD CONSTRAINT diapers_baby_id_fkey
  FOREIGN KEY (baby_id) REFERENCES public.babies(id) ON DELETE CASCADE;

ALTER TABLE public.temperatures DROP CONSTRAINT IF EXISTS temperatures_baby_id_fkey;
ALTER TABLE public.temperatures ADD CONSTRAINT temperatures_baby_id_fkey
  FOREIGN KEY (baby_id) REFERENCES public.babies(id) ON DELETE CASCADE;

ALTER TABLE public.sleeps DROP CONSTRAINT IF EXISTS sleeps_baby_id_fkey;
ALTER TABLE public.sleeps ADD CONSTRAINT sleeps_baby_id_fkey
  FOREIGN KEY (baby_id) REFERENCES public.babies(id) ON DELETE CASCADE;

ALTER TABLE public.baby_members DROP CONSTRAINT IF EXISTS baby_members_baby_id_fkey;
ALTER TABLE public.baby_members ADD CONSTRAINT baby_members_baby_id_fkey
  FOREIGN KEY (baby_id) REFERENCES public.babies(id) ON DELETE CASCADE;