DELETE FROM public.babies WHERE invite_code='TST123';

DROP POLICY IF EXISTS "Members can view babies" ON public.babies;
CREATE POLICY "Members or creator can view babies"
ON public.babies
FOR SELECT
USING (is_baby_member(id, auth.uid()) OR created_by = auth.uid());