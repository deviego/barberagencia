# Entrar com Google — configuração (Diego)

Só o Diego faz estes passos. O secret do Google vai direto no painel do Supabase; não cole em chat, issue,
PR ou arquivo do repositório. Faça primeiro na **staging**, teste, e depois repita na **produção**.

> **Produção só depois do OK do CTO.** Ligar o provedor Google no Supabase de produção libera o login
> pelo Google mesmo com o botão escondido. Espere o CTO avisar que o código e a migration já estão em
> produção.

## 1. Google Cloud (uma vez)
1. console.cloud.google.com → crie (ou escolha) o projeto "Barber Agência".
2. **APIs e serviços → Tela de consentimento OAuth**: tipo **Externo**; nome "Barber Agência"; e-mail de
   suporte; logo opcional; domínio autorizado `barberagencia.com`; links de `/privacidade` e `/termos`.
   Escopos: só `openid`, `email` e `profile`. Publique o app (sai do modo teste).
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Crie um para a staging e
   outro para a produção.
   - **Origens JavaScript autorizadas**: staging `https://barberagencia-git-staging-deviegos-projects.vercel.app`;
     produção `https://www.barberagencia.com`.
   - **URIs de redirecionamento autorizados**: `https://<REF-DO-PROJETO>.supabase.co/auth/v1/callback`
     (o REF está no painel do Supabase → Project Settings → General; use o do projeto certo em cada um).
4. Copie o Client ID e o Client secret direto para o passo 2.

## 2. Supabase (staging, depois produção)
1. **Authentication → Sign In / Providers → Google**: ligar; colar Client ID e Client secret; salvar.
2. **Authentication → Sign In / Providers**: ligar **Allow manual linking**.
3. **Authentication → URL Configuration → Redirect URLs**, adicionar:
   - staging: `https://barberagencia-git-staging-deviegos-projects.vercel.app/client/auth/callback`
   - produção: `https://www.barberagencia.com/client/auth/callback`
   - Só essas URLs exatas. Nunca use curinga (`*`).
4. Avise o CTO: "Google ligado na staging" (sem copiar valores). O Espelho testa.

## Desfazer
Desligar o botão no app (variável `NEXT_PUBLIC_LOGIN_GOOGLE` diferente de `on` na Vercel e redeploy) e
depois o provedor no Supabase. Quem entrou com Google continua com a conta e pode criar uma senha em
"Esqueci minha senha" (o e-mail da conta é o do Google).
