-- ============================================================================
-- Barbearia White-Label — schema v30 (aditivo). Login por telefone robusto.
-- Resolve o e-mail de AUTENTICAÇÃO real a partir do telefone do cliente (funciona
-- tanto para conta telefone-only quanto para conta com e-mail real). SECURITY
-- DEFINER + acesso só ao service_role (usado por um server action; nunca exposto
-- ao anon, para não enumerar telefone→e-mail).
-- Idempotente. Rode com: node dbadmin.mjs supabase/schema-30-auth-phone.sql
-- ============================================================================

create or replace function public.auth_email_for_phone(p_digits text)
returns text
  language sql stable security definer set search_path = public as $$
  select u.email
    from public.clients c
    join auth.users u on u.id = c.user_id
   where c.user_id is not null
     and length(coalesce(p_digits, '')) >= 8
     and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || p_digits
   order by c.created_at asc
   limit 1
$$;

revoke all on function public.auth_email_for_phone(text) from public, anon, authenticated;
grant execute on function public.auth_email_for_phone(text) to service_role;
