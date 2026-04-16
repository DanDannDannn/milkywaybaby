CREATE TABLE public.sleeps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baby_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  logged_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sleeps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sleeps" ON public.sleeps FOR SELECT
USING (is_baby_member(baby_id, auth.uid()));

CREATE POLICY "Members can insert sleeps" ON public.sleeps FOR INSERT
WITH CHECK (is_baby_member(baby_id, auth.uid()) AND logged_by = auth.uid());

CREATE POLICY "Members can update sleeps" ON public.sleeps FOR UPDATE
USING (is_baby_member(baby_id, auth.uid()));

CREATE POLICY "Members can delete sleeps" ON public.sleeps FOR DELETE
USING (is_baby_member(baby_id, auth.uid()));

CREATE TRIGGER trg_sleeps_updated
BEFORE UPDATE ON public.sleeps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sleeps_baby_started ON public.sleeps(baby_id, started_at DESC);