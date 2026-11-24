# 0005 — Entrar com Google (área do cliente)

- Status: Proposto (segurança: aguarda Navalha)
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
1. Uma conta criada pelo Google não traz `tenant_subdomain`. O `handle_new_user` atual cai na barbearia
   padrão quando falta esse dado: **um cadastro pelo Google não pode passar por esse caminho**.
2. O Google não entrega telefone. Telefone é obrigatório no produto (WhatsApp, fila, plano).
3. O telefone identifica contas existentes. Telefone sozinho não prova posse da conta.

## Decisão
1. **Botão** "Entrar com Google" no login e no cadastro do cliente: `signInWithOAuth({ provider: "google" })`
   no navegador (PKCE), com `redirectTo` = `/client/auth/callback?next=/client/confirmar-whatsapp`. A marca
   da barbearia vem do cookie `bb_tenant`, como já acontece no login atual.
2. **Trigger** (migration nova, `schema-65`): quando o provedor da conta nova não é `email`, o
   `handle_new_user` cria só o `profiles` (nome e foto do Google). **Não** cria `clients` nem `memberships`
   e **não** usa barbearia padrão.
3. **Conta pendente**: usuário logado sem `memberships` na área do cliente vai sempre para
   `/client/confirmar-whatsapp` (bloqueio no servidor, não só na tela).
4. **Confirmar WhatsApp** (server action): recebe o telefone.
   - Telefone sem conta: cria `clients` + `memberships` CLIENT na barbearia do `bb_tenant` (validada no
     servidor; sem barbearia válida, erro e nada é criado). Grava o telefone no perfil.
   - Telefone que já tem conta: **nunca vincula só pelo telefone**. Pede prova de posse: senha da conta
     existente (fase 1). Código pelo WhatsApp fica para depois, se o gateway puder (ver Perguntas).
5. **Vínculo com prova**: provada a posse, o servidor encerra a conta provisória criada pelo Google (só se
   ela não tiver nenhum dado além do perfil), entra na conta existente e chama `linkIdentity` (Google).
   Requer "Manual linking" ligado no Supabase Auth.
6. **Perfil**: botão "Conectar com Google" para cliente logado (`linkIdentity` manual).
7. **Vínculo automático por e-mail**: tratamento definido pela revisão de segurança antes do código
   (opções: barrar o vínculo automático e usar o fluxo de prova, ou confiar só no e-mail verificado pelo
   Google com regras extras). O detalhe fica fora do repositório público.
8. **Multi-barbearia**: mesmo comportamento das contas por senha hoje (a conta pertence à barbearia em que
   nasceu). Nada de dado de uma barbearia aparecer em outra; caso testado.
9. **Liga e desliga**: o botão só aparece com `NEXT_PUBLIC_LOGIN_GOOGLE=on` (por ambiente). Na produção fica
   desligado até o QA na staging e o ok do Diego.
10. **Privacidade**: a página `/privacidade` passa a citar o login com Google (nome, e-mail e foto).
11. **Configuração externa** (Google Cloud + Supabase Auth): só o Diego, pelo passo a passo
   `docs/setup/login-google.md`. Nenhum agente vê o secret.

## Consequências
- Uma migration (`schema-65`) e um teste de banco para o trigger.
- Telas novas: confirmar WhatsApp e provar posse da conta.
- Revisão de segurança obrigatória (Navalha) no ADR e em cada PR de auth.
- Testes: cadastro novo com Google; vínculo por telefone com prova; vínculo sem prova falha; mesmo Google
  em 2 barbearias sem vazamento; conta pendente não acessa o app.

## Perguntas abertas
- Código pelo WhatsApp como prova: usa o número da Barber Agência ou o da barbearia? (fase 2)
- Multi-barbearia de verdade (uma conta, várias barbearias) é fora desta fase; ver #160.
