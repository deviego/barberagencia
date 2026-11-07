# E-mail transacional 100% FAILED (item 32 do roadmap)

Data: 2026-11-07 · Autor: Bisturi (Specialist) · Investigação somente leitura (código + config local). Não houve acesso ao painel do Resend, à Vercel nem a produção.

## Sintoma
Relatório da Lupa (22/10): `notification_log` com `channel = 'email'` → 50 de 50 com `status = 'FAILED'`.

## Como o e-mail sai hoje — são DOIS caminhos
| Caminho | Fluxos | Onde | Aparece no `notification_log`? |
|---|---|---|---|
| **Resend** (nosso, `src/server/notifications/resend.ts`) | convite de cliente (`invite`), agendamento confirmado (`appointment_confirmed`), boas-vindas (`notifyWelcome`) | API HTTPS, `RESEND_API_KEY` + `NOTIFICATIONS_FROM` | `invite` e `appointment_confirmed` sim; **boas-vindas não é registrado** |
| **Supabase Auth** (SMTP do projeto) | redefinição de senha (`resetPasswordForEmail`), confirmação de cadastro por e-mail (`signUp`) | painel Supabase → Auth → SMTP | não |

Cadastro do cliente pelo link (`features/auth/actions.ts`) usa `admin.createUser` com `email_confirm: true` — **não manda e-mail do Supabase**; só o de boas-vindas pelo Resend. Login por telefone não depende de e-mail.

## Causa raiz (Resend)
`FAILED` só é gravado quando a `RESEND_API_KEY` **existe** e o Resend **recusa** o envio (sem a chave seria `SKIPPED`). Então, em produção, a chave está configurada e o problema é o remetente:

```ts
const base = process.env.NOTIFICATIONS_FROM || "Barbearia <onboarding@resend.dev>";
```

- Se `NOTIFICATIONS_FROM` não está na Vercel, todo envio sai pelo **sandbox `onboarding@resend.dev`**, que o Resend só entrega para o e-mail do dono da conta. Qualquer cliente → **403** → `FAILED`. Isso bate com 100% de falha.
- Se `NOTIFICATIONS_FROM` está definido mas o domínio **não está verificado** no Resend → também 403 em todos.
- Causa secundária: o nome da barbearia ia sem aspas no `From` (`Barbearia X, Centro <...>`). Nome com vírgula/ponto/parênteses gera **422** mesmo com domínio ok.

Não deu para saber qual das duas primeiras sem o painel: a mensagem de erro **não era gravada** em lugar nenhum (só `FAILED`, sem motivo). No `.env.local`, as duas variáveis estão vazias (por isso local dá `SKIPPED`).

Confirmação rápida (Diego): Resend → **Logs** → os envios recusados mostram o motivo ("domain is not verified" ou "You can only send testing emails to your own email address").

## Impacto
- **Convite de cliente**: e-mail nunca chegou. O WhatsApp do convite segue funcionando (canal separado).
- **Agendamento confirmado**: cliente nunca recebeu o e-mail.
- **Boas-vindas**: provavelmente também falha, e não está no log.
- **Redefinição de senha / confirmação por e-mail (Supabase Auth)**: risco alto e separado. Sem SMTP próprio, o SMTP padrão do Supabase **só entrega para e-mails de membros da equipe do projeto** e tem limite baixo por hora. Ou seja, “esqueci a senha” para dono/cliente muito provavelmente não chega. Os templates ainda estão com a marca Oliveira 01 (pendência #8).

## O que este PR muda (código)
`resend.ts`:
1. Em produção, **sem `NOTIFICATIONS_FROM` não usa o sandbox**: vira `SKIPPED` com log `[email] NOTIFICATIONS_FROM ausente em produção` (o status passa a dizer “configuração”, não “falhou”).
2. Grava o **motivo do Resend** nos logs da Vercel (`[email] Resend 403 — validation_error: ...`), sem o destinatário (LGPD).
3. Nome da barbearia no `From` vai **entre aspas e higienizado** (evita 422).

## Checklist para o Diego (sem segredos aqui)
**A. Resend (resolve convite, agendamento, boas-vindas)**
1. resend.com → **Domains** → *Add domain* → `barberagencia.com` (sugestão: subdomínio `mail.barberagencia.com` ou `notificacoes.barberagencia.com`, para não mexer no e-mail principal).
2. Copiar os registros DNS (SPF/TXT, DKIM, MX de retorno) para o provedor de DNS do domínio. Esperar **Verified**.
3. Opcional, mas recomendado: registro DMARC `_dmarc` com `p=none` para começar.
4. Vercel → projeto → Settings → **Environment Variables** (Production e Preview):
   - `NOTIFICATIONS_FROM` = `Barber Agência <nao-responda@<domínio verificado>>`
   - Conferir que `RESEND_API_KEY` existe (não colar o valor em lugar nenhum).
5. Redeploy.
6. Teste: convidar **um cliente de teste com o seu próprio e-mail** numa barbearia de teste (não usar cliente real) → `notification_log` deve mostrar `SENT` e o Resend → Logs deve mostrar *Delivered*.

**B. Supabase Auth (resolve redefinição de senha e confirmação de e-mail)**
1. Supabase → Project Settings → **Authentication → SMTP Settings** → *Enable custom SMTP*.
2. Host `smtp.resend.com`, porta `465`, usuário `resend`, senha = uma API key do Resend (criar uma chave só para isso, com permissão “Sending access” e só nesse domínio).
3. Sender email = o mesmo endereço do domínio verificado; Sender name = `Barber Agência`.
4. Auth → **Rate Limits**: subir o limite de e-mails por hora (o padrão é muito baixo).
5. Auth → **Email Templates**: trocar a marca Oliveira 01 por texto neutro/white-label (pendência #8).
6. Teste: “esqueci a senha” com o seu próprio e-mail.

## Tarefas propostas
1. (Diego) Checklists A e B acima.
2. (Backend) Coluna `error text` em `notification_log` + gravar o motivo, e registrar `welcome` no log. Precisa de migration → revisão da Navalha.
3. (Backend) Monitor simples: alerta quando `FAILED` > X% em 24h (entra no relatório semanal da Lupa).
4. (Lupa) Depois do deploy, reconsultar a taxa `SENT/FAILED/SKIPPED` em uma semana.
