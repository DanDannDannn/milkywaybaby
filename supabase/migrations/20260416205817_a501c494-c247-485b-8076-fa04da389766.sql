
-- Babies table
CREATE TABLE public.babies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_date DATE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership table
CREATE TYPE public.baby_role AS ENUM ('owner', 'caregiver');

CREATE TABLE public.baby_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.baby_role NOT NULL DEFAULT 'caregiver',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (baby_id, user_id)
);

-- Feedings
CREATE TYPE public.feeding_type AS ENUM ('breast', 'formula');
CREATE TYPE public.feeding_unit AS ENUM ('ml', 'oz');

CREATE TABLE public.feedings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC NOT NULL,
  unit public.feeding_unit NOT NULL DEFAULT 'ml',
  type public.feeding_type NOT NULL DEFAULT 'formula',
  note TEXT,
  logged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Diapers
CREATE TYPE public.diaper_type AS ENUM ('wet', 'dirty', 'mixed');

CREATE TABLE public.diapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.diaper_type NOT NULL,
  note TEXT,
  logged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_baby_members_user ON public.baby_members(user_id);
CREATE INDEX idx_baby_members_baby ON public.baby_members(baby_id);
CREATE INDEX idx_feedings_baby_time ON public.feedings(baby_id, occurred_at DESC);
CREATE INDEX idx_diapers_baby_time ON public.diapers(baby_id, occurred_at DESC);

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_babies_updated BEFORE UPDATE ON public.babies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_feedings_updated BEFORE UPDATE ON public.feedings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_diapers_updated BEFORE UPDATE ON public.diapers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to check membership (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_baby_member(_baby_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.baby_members
    WHERE baby_id = _baby_id AND user_id = _user_id
  );
$$;

-- Auto-add creator as owner member
CREATE OR REPLACE FUNCTION public.add_baby_creator_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.baby_members (baby_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_babies_add_owner AFTER INSERT ON public.babies
  FOR EACH ROW EXECUTE FUNCTION public.add_baby_creator_as_member();

-- Join via invite code (security definer so any logged-in user can join with code)
CREATE OR REPLACE FUNCTION public.join_baby_by_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _baby_id UUID; _uid UUID;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _baby_id FROM public.babies WHERE invite_code = upper(_code);
  IF _baby_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.baby_members (baby_id, user_id, role)
  VALUES (_baby_id, _uid, 'caregiver')
  ON CONFLICT (baby_id, user_id) DO NOTHING;
  RETURN _baby_id;
END; $$;

-- Enable RLS
ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diapers ENABLE ROW LEVEL SECURITY;

-- Babies policies
CREATE POLICY "Members can view babies" ON public.babies FOR SELECT
  USING (public.is_baby_member(id, auth.uid()));
CREATE POLICY "Authenticated users can create babies" ON public.babies FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members can update babies" ON public.babies FOR UPDATE
  USING (public.is_baby_member(id, auth.uid()));
CREATE POLICY "Owner can delete baby" ON public.babies FOR DELETE
  USING (auth.uid() = created_by);

-- baby_members policies
CREATE POLICY "Users see their memberships" ON public.baby_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Users can leave" ON public.baby_members FOR DELETE
  USING (user_id = auth.uid());

-- Feedings policies
CREATE POLICY "Members can view feedings" ON public.feedings FOR SELECT
  USING (public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Members can insert feedings" ON public.feedings FOR INSERT
  WITH CHECK (public.is_baby_member(baby_id, auth.uid()) AND logged_by = auth.uid());
CREATE POLICY "Members can update feedings" ON public.feedings FOR UPDATE
  USING (public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Members can delete feedings" ON public.feedings FOR DELETE
  USING (public.is_baby_member(baby_id, auth.uid()));

-- Diapers policies
CREATE POLICY "Members can view diapers" ON public.diapers FOR SELECT
  USING (public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Members can insert diapers" ON public.diapers FOR INSERT
  WITH CHECK (public.is_baby_member(baby_id, auth.uid()) AND logged_by = auth.uid());
CREATE POLICY "Members can update diapers" ON public.diapers FOR UPDATE
  USING (public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Members can delete diapers" ON public.diapers FOR DELETE
  USING (public.is_baby_member(baby_id, auth.uid()));
