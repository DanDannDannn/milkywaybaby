
CREATE TABLE public.temperatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID NOT NULL REFERENCES public.babies(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_c NUMERIC NOT NULL,
  note TEXT,
  logged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_temperatures_baby_time ON public.temperatures(baby_id, occurred_at DESC);

CREATE TRIGGER trg_temperatures_updated BEFORE UPDATE ON public.temperatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.temperatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view temperatures" ON public.temperatures FOR SELECT
  USING (public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Members can insert temperatures" ON public.temperatures FOR INSERT
  WITH CHECK (public.is_baby_member(baby_id, auth.uid()) AND logged_by = auth.uid());
CREATE POLICY "Members can update temperatures" ON public.temperatures FOR UPDATE
  USING (public.is_baby_member(baby_id, auth.uid()));
CREATE POLICY "Members can delete temperatures" ON public.temperatures FOR DELETE
  USING (public.is_baby_member(baby_id, auth.uid()));
