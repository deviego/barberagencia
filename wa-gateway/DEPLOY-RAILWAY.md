# Deploy do wa-gateway no Railway — sempre ligado, HTTPS automático

Railway roda o serviço 24/7 (plano Hobby ~US$5/mês, inclui US$5 de uso) e já dá
HTTPS num domínio `*.up.railway.app` — sem mexer em DNS nem servidor. As sessões
ficam no Supabase (`wa_sessions`), então sobrevivem a restart/redeploy.

O repo é um monorepo → o segredo é apontar o **Root Directory** para `wa-gateway`.
O arquivo `wa-gateway/railway.json` já define start (`node index.js`) e healthcheck (`/health`).

---

## 1. Criar o projeto a partir do GitHub

1. Entre em https://railway.app e faça login com o GitHub.
2. **New Project → Deploy from GitHub repo** → autorize e escolha **deviego/barberagencia**.
3. O Railway cria um serviço e tenta o 1º build (pode falhar até você ajustar o passo 2).

## 2. Apontar o Root Directory

No serviço → **Settings → Build (ou Source)**:
- **Root Directory**: `wa-gateway`
- (Opcional) **Watch Paths**: `wa-gateway/**` — só redeploya quando o gateway muda.

Assim o Nixpacks lê `wa-gateway/package.json`, roda `npm install` e usa o `railway.json`
(start `node index.js`, Node 22 via `engines`).

## 3. Variáveis de ambiente

No serviço → aba **Variables** → adicione:
| Variável | Valor |
|---|---|
| `WA_SERVICE_TOKEN` | **o mesmo** token que está no Vercel |
| `SUPABASE_URL` | `https://tusfxbnnrypjtzqcvpov.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | sua service_role (Supabase → Settings → API) |

> **Não** defina `PORT` — o Railway injeta o `PORT` automaticamente e o `index.js` já usa
> `process.env.PORT`. (O keep-alive/RENDER_EXTERNAL_URL também não é necessário aqui.)
>
> O `WA_SERVICE_TOKEN` **precisa ser idêntico** ao do Vercel — copie o valor de lá
> (Vercel → Settings → Environment Variables) e cole aqui.

## 4. Gerar o domínio público (HTTPS)

No serviço → **Settings → Networking → Public Networking → Generate Domain**.
- Ele cria algo como `wa-gateway-production-xxxx.up.railway.app` com HTTPS.
- Se pedir a porta, use a que o app escuta (a injetada pelo Railway — normalmente detecta sozinho).

Deploy roda automático. Teste no navegador/terminal:
```
https://SEU-SERVICO.up.railway.app/health   →   {"ok":true,...}
```

## 5. Apontar o app (Vercel) para o Railway

No **Vercel → Projeto → Settings → Environment Variables** (Production):
- `WA_SERVICE_URL` = `https://SEU-SERVICO.up.railway.app`
- `WA_SERVICE_TOKEN` = (o mesmo do Railway)

Depois **Redeploy** o projeto (Deployments → ⋯ → Redeploy).

## 6. Conectar o WhatsApp

Admin de uma barbearia → **Configurações → WhatsApp → Conectar** → leia o QR.
Aguarde ~15–20s após "conectado" antes do primeiro envio.

---

### Operação
- **Logs**: aba **Deployments/Logs** do serviço (procure `wa-gateway ouvindo na porta` e `conectado`).
- **Atualizar**: dê `git push` — o Railway redeploya sozinho (se Watch Paths permitir).
- **Reiniciar**: no serviço, **Deployments → Redeploy** (ou Restart).
- **Domínio próprio** (opcional): Settings → Networking → Custom Domain → `wa.barberagencia.com`
  (adicione o CNAME que o Railway indicar no seu DNS). Aí `WA_SERVICE_URL` vira `https://wa.barberagencia.com`.

### Custo
- **Hobby** ~US$5/mês (inclui US$5 de uso). O gateway é leve; o consumo tende a caber no incluído.
- Precisa **adicionar um cartão** no Railway (Account → Billing) para o serviço ficar always-on.

### Observações
- As credenciais das sessões vivem no Supabase (`wa_sessions`) → re-hidratação automática no boot.
- Nunca comite a `service_role`. Ela fica só nas Variables do Railway.
