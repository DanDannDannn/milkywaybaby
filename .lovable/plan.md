# Fix: signed-in users can't load app data

## Root cause

Yesterday's security hardening revoked `EXECUTE` on `public.is_baby_member(uuid, uuid)` from `authenticated`. But that function is called **inside the RLS policies** on `babies`, `baby_members`, and `profiles`:

- `babies` SELECT: `is_baby_member(id, auth.uid()) OR created_by = auth.uid()`
- `babies` UPDATE: `is_baby_member(id, auth.uid())`
- `baby_members` SELECT: `user_id = auth.uid() OR is_baby_member(baby_id, auth.uid())`
- `profiles` SELECT (co-caregivers): joins via `baby_members`

RLS policy expressions run as the querying role (`authenticated`). Without `EXECUTE`, every read of these tables errors with `permission denied for function is_baby_member`. Auth logs confirm sign-in itself succeeds (HTTP 200 on `/token`), so the user logs in but the app can't load any baby/profile data and appears stuck.

The other revoked functions are fine: `handle_new_user`, `add_baby_creator_as_member`, and `update_updated_at_column` are trigger functions (Postgres does not check `EXECUTE` for triggers), and `join_baby_by_code` was intentionally kept callable by `authenticated`.

Email verification is unrelated — auth confirmation settings weren't changed yesterday, and the failing logins from `heywudan@gmail.com` were `invalid_credentials` (wrong password), not unconfirmed-email.

## Fix

Single migration that restores the missing grant:

```sql
GRANT EXECUTE ON FUNCTION public.is_baby_member(uuid, uuid) TO authenticated;
```

This is safe to expose: `is_baby_member` is `SECURITY DEFINER STABLE` and only returns a boolean from a membership lookup keyed by the caller-supplied ids. It does not leak data beyond what the existing RLS policies already authorize.

## Verification

1. Run the migration.
2. Re-test sign-in in the published app (`milkywaybaby.lovable.app`) — the home page should load the baby list and today's summary instead of hanging.
3. Update `mem://security` to note that any helper invoked from an RLS policy must keep `EXECUTE` for the roles whose policies reference it.
