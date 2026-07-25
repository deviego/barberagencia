-- ============================================================================
-- schema v10 (aditivo) — invite_status passa a retornar também o telefone,
-- para o formulário de aceite pré-preencher e propagar ao cadastro. Idempotente.
-- ============================================================================
drop function if exists public.invite_status(text);
create function public.invite_status(p_token text)
  returns table(valid boolean, email text, name text, phone text)
  language sql security definer set search_path = public as $$
  select (i.status = 'PENDING' and i.expires_at > now()) as valid, i.email, i.name, i.phone
  from public.client_invites i
  where i.token = p_token;
$$;
grant execute on function public.invite_status(text) to anon, authenticated;
