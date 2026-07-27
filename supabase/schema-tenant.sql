-- Multi-tenant real: leitura pública de marca + cadastro ciente do tenant.

-- 1) Leitura pública de tenant + branding (a marca é pública: /b/{slug}, login e cadastro anônimos).
drop policy if exists tenants_public_read on public.tenants;
create policy tenants_public_read on public.tenants for select using (true);

drop policy if exists branding_public_read on public.branding;
create policy branding_public_read on public.branding for select using (true);

-- 2) Cadastro ciente do tenant: lê tenant_subdomain do metadata; fallback oliveira01.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t_id uuid;
  sub text;
begin
  insert into public.profiles (id, full_name, phone)
    values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
    on conflict (id) do nothing;

  sub := coalesce(nullif(new.raw_user_meta_data->>'tenant_subdomain', ''), 'oliveira01');
  select id into t_id from public.tenants where subdomain = sub limit 1;
  if t_id is null then
    select id into t_id from public.tenants where subdomain = 'oliveira01' limit 1;
  end if;

  if t_id is not null then
    insert into public.clients (tenant_id, user_id, name, email, phone)
      values (
        t_id, new.id,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email, new.raw_user_meta_data->>'phone'
      );
    insert into public.memberships (user_id, tenant_id, role)
      values (new.id, t_id, 'CLIENT')
      on conflict do nothing;
  end if;
  return new;
end $function$;
