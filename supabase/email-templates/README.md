# E-mails de autenticação (Supabase)

Templates **white-label** (sem marca de nenhuma barbearia) para substituir os e-mails padrão do Supabase.

Os templates de Auth do Supabase valem para o **projeto inteiro**: o mesmo e-mail sai para clientes de todas as barbearias. Por isso eles não podem carregar nome, telefone, Instagram ou horário de uma barbearia específica.

| Arquivo | Template no Supabase | Assunto sugerido |
|---|---|---|
| `confirmacao-cadastro.html` | **Confirm signup** | `Confirme seu e-mail para ativar sua conta` |
| `recuperacao-senha.html` | **Reset password** | `Redefinição de senha da sua conta` |

## Como aplicar (colar no painel) — Diego

1. Abra o **Supabase Dashboard** do projeto de produção.
2. Menu **Authentication** → **Email Templates**.
3. Selecione **Confirm signup**:
   - **Subject**: cole o assunto sugerido da tabela (substitui o assunto atual com a marca antiga).
   - **Message body**: apague o conteúdo atual e cole **todo** o HTML de `confirmacao-cadastro.html`.
   - Clique em **Save**.
4. Selecione **Reset password** e repita com `recuperacao-senha.html`.
5. Confira também **Magic Link**, **Invite user** e **Change email address**: se algum estiver com a marca antiga, troque o nome da barbearia por um texto neutro.
6. Em **Authentication → SMTP Settings**, confira se o *Sender name* não está com o nome de uma barbearia.

## Regras

- **Não** use `{{ .Data.* }}` (metadados do usuário, ex.: `full_name`) no HTML. Esses valores são digitados pelo próprio usuário no cadastro; colocá-los no e-mail abre espaço para injeção de HTML/links de phishing saindo do nosso domínio.
- A variável `{{ .ConfirmationURL }}` é preenchida automaticamente pelo Supabase — não altere.
- **Redirect URLs**: em **Authentication → URL Configuration**, a lista de *Redirect URLs* deve incluir só os domínios de produção (ex.: `https://barberagencia.com/**`) e de preview autorizados. Evite curingas amplos.
- O link de recuperação deve ser aberto **no mesmo navegador** em que foi solicitado (fluxo PKCE).
- Os comentários `<!-- ... -->` no topo de cada arquivo são só instruções; pode colar junto (não afetam o e-mail) ou removê-los.
- `confirm-signup.html` (versão antiga duplicada) foi removido; use só `confirmacao-cadastro.html`.
