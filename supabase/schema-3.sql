-- ============================================================================
-- schema v3 (aditivo) — RPCs de convite de cliente (acesso público por token).
-- ============================================================================

create or replace function public.invite_status(p_token text)
  returns table(valid boolean, email text, name text)
  language sql security definer set search_path = public as $$
  select (i.status = 'PENDING' and i.expires_at > now()) as valid, i.email, i.name
  from public.client_invites i
  where i.token = p_token;
$$;

create or replace function public.accept_invite(p_token text)
  returns void
  language sql security definer set search_path = public as $$
  update public.client_invites set status = 'ACCEPTED'
  where token = p_token and status = 'PENDING' and expires_at > now();
$$;

-- permitir chamada por usuários anônimos/autenticados
grant execute on function public.invite_status(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to anon, authenticated;
