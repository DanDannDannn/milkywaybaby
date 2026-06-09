
-- 1) Profiles: restrict SELECT to self or co-members of a shared baby
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view co-caregiver profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.baby_members bm_self
    JOIN public.baby_members bm_other ON bm_other.baby_id = bm_self.baby_id
    WHERE bm_self.user_id = auth.uid()
      AND bm_other.user_id = profiles.user_id
  )
);

-- 2) baby_members: block direct inserts/updates. Legitimate inserts happen
--    via SECURITY DEFINER functions (join_baby_by_code, add_baby_creator_as_member).
CREATE POLICY "Block direct membership inserts"
ON public.baby_members
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Block direct membership updates"
ON public.baby_members
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- 3) Lock down SECURITY DEFINER functions: revoke from anon/authenticated/public
REVOKE ALL ON FUNCTION public.is_baby_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_baby_creator_as_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- join_baby_by_code must remain callable by signed-in users (it's the only path to join)
REVOKE ALL ON FUNCTION public.join_baby_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_baby_by_code(text) TO authenticated;
