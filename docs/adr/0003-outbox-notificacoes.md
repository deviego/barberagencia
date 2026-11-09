# 0003 — Outbox de notificações do WhatsApp

- Status: Aceito (CTO, 2026-11-07)
- Item do roadmap: 10 (relacionado: 11, 27)
- Autor: Alicerce (Tech Lead)

## Contexto
`src/server/notifications/notify.ts` (632 linhas) chama `sendWhatsApp` de forma síncrona dentro das
server actions do usuário. Se o gateway (Baileys, processo único para todos os tenants) estiver lento ou
fora, a ação do usuário fica lenta ou o aviso se perde em silêncio: não há timeout, retry nem histórico.

## Decisão
- Tabela `notification_outbox`: `id`, `tenant_id`, `kind`, `to_phone`, `payload jsonb`, `status`
  (`pending|sending|sent|failed|dead`), `attempts`, `next_attempt_at`, `last_error`, `dedupe_key` (único),
  `created_at`, `sent_at`. RLS: o tenant só lê as próprias linhas; escrita apenas pelo servidor.
- As actions só fazem INSERT no outbox (rápido, na mesma operação do agendamento).
- Um worker (`/api/jobs/outbox`, chamado por Vercel Cron a cada minuto, protegido por segredo em variável de
  ambiente) pega lotes com `FOR UPDATE SKIP LOCKED`, envia com timeout, backoff exponencial e máximo de
  tentativas, e limite de envio por tenant/número. Uso de service role justificado: o worker atende todos os tenants.
- Nada de envio em massa: o outbox só carrega avisos transacionais 1 a 1.

## Consequências
- Actions rápidas e confiáveis; avisos auditáveis (o dono pode ver o que saiu e o que falhou).
- Base para lembretes 24h/2h e medição de no-show (item 27) e para o health do gateway (item 11).
- Custo: até ~1 min de atraso no aviso e um cron para monitorar.
- Migração nova com RLS → revisão obrigatória da Navalha. Dono: Engrenagem; lado do gateway: Bisturi.
