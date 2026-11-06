-- ============================================================================
-- Importação/migração de dados (import_jobs + rastreio por registro). Idempotente.
--
--   >>> APLICAR MANUALMENTE (SQL Editor do Supabase / psql), NÃO roda sozinha. <<<
--   O app funciona sem ela (importa normalmente), mas o histórico de importações e o
--   "Desfazer importação" ficam indisponíveis até aplicar — a tela avisa.
--
--   - import_jobs: 1 linha por importação (origem, entidade, contagens, erros, quem fez).
--     RLS: leitura só para MASTER; escrita só via service role (server actions do Master).
--   - clients/services/products.import_job_id: qual importação criou o registro
--     (só em INSERT — registros atualizados pela importação NÃO recebem o id, então o
--     "desfazer" nunca apaga o que já existia antes).
-- ============================================================================

create table if not exists public.import_jobs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  source      text not null default 'generic',
  entity      text not null check (entity in ('clients', 'products', 'services')),
  file_name   text,
  created_by  uuid references public.profiles(id) on delete set null,
  counts      jsonb not null default '{}'::jsonb,
  errors      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  undone_at   timestamptz
);
create index if not exists import_jobs_tenant_idx on public.import_jobs (tenant_id, created_at desc);

alter table public.import_jobs enable row level security;

-- Leitura: só MASTER. Sem policy de escrita para authenticated → só service role grava.
drop policy if exists import_jobs_master_read on public.import_jobs;
create policy import_jobs_master_read on public.import_jobs for select
  using (exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'MASTER'));

revoke insert, update, delete on public.import_jobs from anon, authenticated;

-- Rastreio do job em cada registro criado pela importação.
alter table public.clients  add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;
alter table public.services add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;
alter table public.products add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;

create index if not exists clients_import_job_idx  on public.clients  (import_job_id) where import_job_id is not null;
create index if not exists services_import_job_idx on public.services (import_job_id) where import_job_id is not null;
create index if not exists products_import_job_idx on public.products (import_job_id) where import_job_id is not null;
