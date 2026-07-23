# E-mails de autenticação (Supabase)

Templates com a identidade da **Barbearia Oliveira 01** para substituir os e-mails padrão do Supabase.

| Arquivo | Template no Supabase | Assunto sugerido |
|---|---|---|
| `confirmacao-cadastro.html` | **Confirm signup** | `Confirme seu cadastro — Barbearia Oliveira 01` |
| `recuperacao-senha.html` | **Reset password** | `Redefinição de senha — Barbearia Oliveira 01` |

## Como aplicar (colar no painel)

1. Abra o **Supabase Dashboard** → projeto `tusfxbnnrypjtzqcvpov`.
2. Menu **Authentication** → **Email Templates**.
3. Selecione **Confirm signup**:
   - **Subject**: cole o assunto sugerido da tabela.
   - **Message body**: apague o conteúdo atual e cole **todo** o HTML de `confirmacao-cadastro.html`.
   - Clique em **Save**.
4. Selecione **Reset password** e repita com `recuperacao-senha.html`.

## Observações

- A variável `{{ .ConfirmationURL }}` é preenchida automaticamente pelo Supabase — não altere.
- **Redirect URLs**: em **Authentication → URL Configuration**, garanta que a lista de *Redirect URLs* inclua o callback de produção, ex.: `https://barberagencia.vercel.app/auth/callback` (ou o padrão `https://barberagencia.vercel.app/**`). É por ele que passam a confirmação de cadastro e a recuperação de senha.
- O link de recuperação deve ser aberto **no mesmo navegador** em que foi solicitado (fluxo PKCE).
- Os comentários `<!-- ... -->` no topo de cada arquivo são só instruções; pode colar junto (não afetam o e-mail) ou removê-los.
