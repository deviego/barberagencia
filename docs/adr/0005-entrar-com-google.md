# 0005 — Entrar com Google (área do cliente)

- Status: Aceito com ajustes (segurança: Navalha, #168, 24/11)
- Decisão de produto: Diego, 2026-11-24
- Autor: Alicerce (Tech Lead)

## Contexto
Hoje o cliente da barbearia entra com telefone + senha (por baixo, um e-mail técnico gerado a partir do
telefone, `src/lib/auth/phone-identity.ts`) ou com e-mail + senha. A conta é criada já confirmada pelo
servidor (`registerClientAccount`), e o trigger `handle_new_user` cria `profiles`, `clients` e o
`memberships` CLIENT na barbearia indicada em `user_metadata.tenant_subdomain`.

O Diego quer "Entrar com Google" para reduzir atrito no cadastro. Fase 1: **só cliente** (link
`/b/<slug>`, `/client/login`, `/client/cadastro`). Dono e equipe continuam com e-mail + senha.

Pontos que o código atual impõe:
1. Uma conta criada pelo Google não traz `tenant_subdomain`. O `handle_new_user` em vigor
   (`schema-invite-fix.sql`) já trata esse caso: cria só o `profiles`, sem `clients`/`memberships` e sem
   barbearia padrão. A barbearia é definida depois, na confirmação do WhatsApp.
2. O Google não entrega telefone. Telefone é obrigatório no produto (WhatsApp, fila, plano).
3. O telefone identifica contas existentes. Telefone sozinho não prova posse da conta.

## Decisão
1. **Botão** "Entrar com Google" no login e no cadastro do cliente: `signInWithOAuth({ provider: "google" })`
   no navegador (PKCE), com `redirectTo` = `/client/auth/callback?next=/client/confirmar-whatsapp`. A marca
   da barbearia vem do cookie `bb_tenant`, como já acontece no login atual.
2. **Trigger** (`schema-65`, a partir do corpo em vigor do `schema-invite-fix.sql`): só cria `clients` e
   `memberships` quando o provedor da conta (`raw_app_meta_data`, controlado pelo servidor) é `email`.
   Qualquer outro provedor cria só o `profiles`. Google não reconcilia convite na fase 1.
3. **Callback e conta pendente**: o callback grava sempre a sessão da área do cliente (inclusive com
   "ver como cliente" ativo), usa PKCE com o cookie dessa área e aceita em `next` só caminho interno de
   `/client` (qualquer outro valor vira `/client`). Sem `memberships`, o destino é sempre
   `/client/confirmar-whatsapp`, ignorando `next`; o mesmo bloqueio vale no servidor para todo `/client`.
4. **Confirmar WhatsApp** (server action): recebe o telefone.
   - Telefone sem conta: cria `clients` + `memberships` CLIENT na barbearia do `bb_tenant` (validada no
     servidor; sem barbearia válida, erro e nada é criado). Grava o telefone no perfil.
   - Telefone que já tem conta: **nunca vincula só pelo telefone**. Pede prova de posse: senha da conta
     existente (fase 1, decisão do CTO 24/11). Código pelo WhatsApp fica para depois. Quem não lembra a
     senha e tem conta só por telefone não tem recuperação sozinho hoje: a tela orienta "fale com a
     barbearia" (ver issue de recuperação de senha por telefone).
5. **Vínculo com prova**, nesta ordem: valida a senha da conta existente (com limite próprio de
   tentativas, mensagem neutra) → descarta a conta provisória do Google (só no servidor, só a da sessão
   atual, só se for apenas Google, sem nenhum dado e criada há menos de 24 h) → entra na conta existente
   → `linkIdentity` (Google). Requer "Manual linking" ligado no Supabase Auth. Desistir no meio deixa só a
   conta existente.
6. **Perfil**: botão "Conectar com Google" para cliente logado (`linkIdentity` manual).
7. **Vínculo automático por e-mail**: barrado no callback. Vínculo só com intenção explícita (perfil ou
   fluxo de prova). Contas novas por senha passam a usar o e-mail técnico como e-mail de autenticação; o
   e-mail real fica só como contato (login por e-mail e "Esqueci minha senha" ajustados para isso).
8. **Multi-barbearia**: mesmo comportamento das contas por senha hoje (a conta pertence à barbearia em que
   nasceu). Nada de dado de uma barbearia aparecer em outra; caso testado.
9. **Liga e desliga**: o botão só aparece com `NEXT_PUBLIC_LOGIN_GOOGLE=on` (por ambiente). Na produção fica
   desligado até o QA na staging e o ok do Diego.
10. **Privacidade**: a página `/privacidade` passa a citar o login com Google (nome, e-mail e foto).
11. **Configuração externa** (Google Cloud + Supabase Auth): só o Diego, pelo passo a passo
   `docs/setup/login-google.md`. Nenhum agente vê o secret.

## Consequências
- Uma migration (`schema-65`) com teste de banco para o trigger.
- Telas novas: confirmar WhatsApp e provar posse da conta.
- Revisão de segurança obrigatória (Navalha) no ADR e em cada PR de auth.
- Testes: cadastro novo com Google; vínculo por telefone com prova; vínculo sem prova falha; mesmo Google
  em 2 barbearias sem vazamento; conta pendente não acessa o app.

## Perguntas abertas
- Código pelo WhatsApp como prova (fase 2): usa o número da Barber Agência ou o da barbearia?
- Multi-barbearia de verdade (uma conta, várias barbearias) é fora desta fase; ver #160.
