# wa-gateway — Gateway de WhatsApp (Baileys)

Serviço Node **multi-tenant** que conecta o WhatsApp de cada barbearia (via QR)
e envia mensagens. As credenciais ficam no Supabase (tabela `wa_sessions`), então
a sessão sobrevive a reinícios (sem reescanear).

## Rodar local
```bash
cd wa-gateway
npm install
WA_SERVICE_TOKEN=um-segredo \
SUPABASE_URL=https://SEU-REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
PORT=8080 \
node index.js
```
`GET http://localhost:8080/health` → `{ ok: true }`.

## Variáveis de ambiente
- `WA_SERVICE_TOKEN` — segredo compartilhado com o app (header `x-wa-token`).
- `SUPABASE_URL` — URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — service role (server-only; bypassa RLS).
- `PORT` — porta (Render injeta automaticamente).

## Endpoints (todos exigem header `x-wa-token`)
- `POST /sessions/:tenantId/connect` → `{ status, qr?, number? }`
- `GET  /sessions/:tenantId/status`  → `{ status: connecting|qr|connected|disconnected, qr?, number? }`
- `POST /sessions/:tenantId/send`    → body `{ phone, message }`
- `POST /sessions/:tenantId/logout`
- `GET  /health`

## Deploy no Render
1. New → **Web Service** → conecte o repositório.
2. **Root Directory**: `wa-gateway`
3. **Build Command**: `npm install`
4. **Start Command**: `node index.js`
5. **Environment**: `WA_SERVICE_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
6. Recomendado o plano **Starter** (o free dorme após 15 min e derruba a conexão).

No app (Vercel): setar `WA_SERVICE_URL` = URL pública do Render e `WA_SERVICE_TOKEN` (mesmo valor).

> WhatsApp não-oficial (Baileys): use com moderação — há risco de bloqueio do número.
