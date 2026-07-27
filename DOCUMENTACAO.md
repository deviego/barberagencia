# 📘 Documentação da Plataforma — Barbearia

Manual funcional completo, separado em **App do Cliente** e **Painel do Admin**. Explica, passo a passo, tudo o que cada perfil consegue fazer.

---

## Sumário

1. [Visão geral da plataforma](#1-visão-geral-da-plataforma)
2. [Conceitos-chave](#2-conceitos-chave)

**PARTE 1 — APP DO CLIENTE**
3. [Cadastro e acesso](#3-cadastro-e-acesso)
4. [Tela inicial (Home)](#4-tela-inicial-home)
5. [Agendar (passo a passo)](#5-agendar-passo-a-passo)
6. [Planos e assinatura](#6-planos-e-assinatura)
7. [Meus pedidos](#7-meus-pedidos)
8. [Produtos](#8-produtos)
9. [Perfil](#9-perfil)
10. [Suporte](#10-suporte)
11. [Avisos que o cliente recebe](#11-avisos-que-o-cliente-recebe)

**PARTE 2 — PAINEL DO ADMIN**
12. [Acesso e navegação](#12-acesso-e-navegação)
13. [Dashboard](#13-dashboard)
14. [Solicitações](#14-solicitações)
15. [Agenda](#15-agenda)
16. [Pedidos (comanda ao vivo)](#16-pedidos-comanda-ao-vivo)
17. [Clientes](#17-clientes)
18. [Serviços e Planos](#18-serviços-e-planos)
19. [Produtos](#19-produtos-admin)
20. [Barbeiros](#20-barbeiros)
21. [Financeiro](#21-financeiro)
22. [Marketing](#22-marketing)
23. [Mensagens](#23-mensagens)
24. [Configurações](#24-configurações)
25. [Avisos que o admin dispara](#25-avisos-que-o-admin-dispara)

**ENCERRAMENTO**
26. [Regras de negócio (resumo)](#26-regras-de-negócio-resumo)
27. [Glossário](#27-glossário)

---

## 1. Visão geral da plataforma

A plataforma é um aplicativo de **agendamento + fidelização por assinatura** para barbearia. Ela tem **duas visões**:

- **App do Cliente** — onde o cliente agenda cortes, assina planos mensais, acompanha seus pedidos, reserva produtos e fala com a barbearia.
- **Painel do Admin** — onde a barbearia recebe e confirma os pedidos, gerencia a agenda, o atendimento ao vivo, clientes, serviços, produtos, barbeiros, financeiro e comunicação.

Pontos importantes do modelo:

- **O pagamento é feito no local**, após o atendimento (PIX, crédito, débito ou dinheiro). Não há cobrança online dentro do app.
- **Os avisos ao cliente são automáticos**, principalmente por **WhatsApp** (e e-mail em alguns casos): confirmação, início/fim de atendimento, assinatura, cancelamentos, etc.
- Várias telas atualizam **em tempo real** (sem precisar recarregar): a fila de solicitações do admin e a tela de acompanhamento do cliente.

---

## 2. Conceitos-chave

Antes dos detalhes, alguns conceitos que se repetem no documento:

- **Solicitação → Aprovação.** Quando o cliente **agenda** ou **assina/troca/cancela um plano**, isso vira uma **solicitação** que a barbearia **aprova** no painel. Nada é confirmado automaticamente sem o admin (exceto o que o próprio admin cria).
- **Saldo de cortes.** Quem tem plano ativo tem um **saldo mensal** (ex.: 4 cortes). Cada agendamento pelo plano **consome 1 corte**; ao cancelar, o corte **volta** ao saldo. O saldo renova no dia de cobrança.
- **Pedido / Comanda.** Um agendamento é uma **comanda**: pode ter **vários itens** (serviços e produtos). Um item pode ser **coberto pelo plano** (não é cobrado) ou **avulso** (pago no local).
- **Avulso × Coberto pelo plano.** O plano cobre **1 corte** por atendimento; serviços/produtos extras são **avulsos** e entram no total a pagar no local.
- **Tempo real.** A fila de **Solicitações** do admin toca um som e atualiza sozinha quando chega algo novo; a **tela de confirmação** do cliente muda sozinha quando o admin decide.

---

# PARTE 1 — APP DO CLIENTE

## 3. Cadastro e acesso

### O que é
A porta de entrada do cliente: criar conta, entrar e recuperar a senha.

### Passo a passo — criar conta
1. Na tela de login, tocar em **Cadastrar**.
2. Preencher **nome completo, e-mail, telefone e senha**.
3. **Aceitar os Termos de Uso e a Política de Privacidade** (dois itens obrigatórios; os links abrem as páginas completas).
4. Concluir o cadastro. Um **e-mail de boas-vindas** é enviado e a conta já fica pronta para uso.

### Passo a passo — entrar
1. Informar **e-mail e senha** e tocar em **Entrar**.

### Passo a passo — recuperar senha
1. Na tela de login, tocar em **Esqueci minha senha**.
2. Informar o **e-mail** e enviar — chega um link por e-mail.
3. Ao abrir o link, cair direto na tela de **nova senha** (com medidor de força) e salvar. Pronto: já entra logado.

> 💡 **Observação:** o link de redefinição deve ser aberto **no mesmo navegador** em que foi solicitado. Os documentos de **Termos** e **Privacidade** ficam disponíveis a qualquer momento (links no rodapé das telas de acesso e no cadastro).

---

## 4. Tela inicial (Home)

### O que é
O painel do cliente logado, com o essencial à mão.

### O que aparece
- **Saudação** com o primeiro nome e a data.
- **Card do próximo agendamento** (quando existe), mostrando serviço, data/hora, barbeiro e status. Nele o cliente pode:
  - **➕ Adicionar serviço** (leva ao pedido para incluir mais itens);
  - **Reagendar** (quando ainda não confirmado);
  - **Cancelar**.
- **Medidor de cortes** (só para assinantes): mostra quantos cortes restam no mês, o nome do plano e o dia de renovação, com o botão **Ver meu plano**.
- **Botão grande "Agendar"** — atalho principal. Se o cliente tem plano com saldo, vai **direto** para a escolha de data/horário; senão, abre a lista de serviços.
- **Atalho "Suporte"**.

### Menu inferior (sempre visível)
**Início · Agendar · Pedidos · Meu plano · Perfil.**

> ⚠️ **Regra:** quando o agendamento já está **confirmado**, o cliente vê **apenas Cancelar** (não é possível reagendar um confirmado — nesse caso, cancele e agende de novo, ou fale no WhatsApp).

---

## 5. Agendar (passo a passo)

### O que é
O fluxo de marcar um horário. Um agendamento pode conter **vários serviços e produtos** (é uma comanda).

### Passo 1 — Escolher o ponto de partida (Serviços)
- Na tela **Serviços**, o cliente vê:
  - **Avulsos** — cada serviço com **preço** e **tempo médio** (ex.: "Tempo médio ~45 min").
  - **Assinaturas mensais (planos)** — com a lista de **benefícios** de cada plano.
- Escolher um **serviço avulso** e tocar em **Continuar** leva ao montador do pedido. (Escolher um **plano** segue para a assinatura — ver seção 6.)

### Passo 2 — Montar o pedido
Na tela **Montar pedido**, o cliente define:
1. **Barbeiro**.
2. **Serviços** — pode marcar mais de um; cada chip mostra **tempo médio** e **preço**.
3. **Produtos** (opcional) — com seletor de quantidade.
4. **Corte infantil** — se um dos serviços escolhidos é **infantil**, aparece a seção **"Para qual criança?"**: escolher uma criança já cadastrada **ou** **Registrar criança** (nome, idade e foto) na hora.
5. **Data e horário** — os dias aparecem em sequência; os horários **ocupados aparecem riscados** e os **horários que já passaram** ficam bloqueados.
6. **Forma de pagamento (no local)** — PIX, Crédito, Débito ou Dinheiro.
7. **Observações (opcional)** — campo livre para avisar algo ao barbeiro (ex.: "máquina 2 nas laterais", alergia a produto).

### Passo 3 — Revisar e enviar
- O **Resumo do pedido** lista os itens, marca o que é **"Plano · incluído"**, mostra o **total a pagar no local** e o **tempo médio estimado**.
- Tocar em **Solicitar agendamento** envia o pedido.

### Passo 4 — Acompanhar em tempo real
- O cliente cai na tela **Solicitação enviada** (status **Aguardando confirmação**).
- Essa tela **atualiza sozinha** quando o admin decide:
  - **Confirmado** ✅ — horário garantido (chega confirmação no WhatsApp);
  - **Não confirmado** ❌ — recusado ou expirado (com atalho para **Agendar novamente**);
  - **Outro horário sugerido** — conferir em **Meus agendamentos**.

> 💡 **Observação:** se o cliente tem plano com saldo, o **1º corte do pedido é coberto pelo plano** (aparece "incluído") e consome 1 corte; os extras são avulsos. Sem plano ou com saldo zerado, tudo é avulso (pago no local).

---

## 6. Planos e assinatura

### O que é
Assinatura mensal (combo) que dá cortes inclusos e vantagens.

### Ver e entender o plano
Cada plano mostra os **benefícios** de forma clara, por exemplo:
- **4 cortes no mês**;
- **1ª mensalidade = valor de adesão**;
- **a partir do 2º mês = valor cheio**;
- **desconto em produtos** (cremes, bálsamos).

### Passo a passo — assinar
1. Em **Serviços**, escolher um plano e tocar em **Assinar combo**.
2. Abre um **modal de confirmação** com o nome do plano, os benefícios e a mensalidade.
3. Confirmar → é criada uma **solicitação de assinatura** (não ativa na hora) e aparece a tela **"Solicitação enviada!"**.
4. O cliente recebe um **WhatsApp** confirmando o pedido.
5. Quando o admin **aprova**, o plano é ativado e chega o **WhatsApp de confirmação detalhada** (benefícios, mensalidade, saldo e dia de renovação).

### Meu plano
Na aba **Meu plano**, o assinante vê:
- Nome do plano, **benefícios**, **mensalidade**, **saldo de cortes** e **dia de renovação**.
- **Trocar de plano** e **Cancelar assinatura** — ambos viram **pedido que aguarda aprovação** do admin; enquanto pendente, aparece um **aviso de "solicitação em análise"**.

> ⚠️ **Regra:** a **primeira assinatura**, a **troca** e o **cancelamento** sempre passam pela **aprovação do admin**. O plano atual continua valendo até a decisão.

---

## 7. Meus pedidos

### O que é
A aba **Pedidos** reúne **todos** os pedidos do cliente (futuros, em atendimento e passados).

### Como usar
1. A lista mostra cada pedido com data/hora, status e valor.
2. Tocar em um pedido abre o **detalhamento**: itens, valores, barbeiro e status.
3. Em pedidos ainda editáveis, o cliente pode **adicionar/remover** serviços e produtos:
   - Os itens **já no pedido aparecem selecionados** (✓ e destaque);
   - Tocar em um item **não selecionado** o **adiciona**; tocar em um **selecionado** o **remove** — assim **não dá para incluir o mesmo item duas vezes**;
   - O item **coberto pelo plano** fica travado (não é removível).
4. Durante o atendimento, o pedido mostra **"Em atendimento" + cronômetro**.

> 💡 **Observação:** o botão **➕ Adicionar serviço** da Home e dos cards de agendamento leva exatamente para esse detalhamento do pedido.

---

## 8. Produtos

### O que é
Catálogo de produtos da barbearia (cremes, bálsamos, etc.).

### Como usar
1. Ver os produtos com preço.
2. Tocar em **Solicitar/Reservar** e escolher a **quantidade** para **retirada no local**.
3. A reserva fica registrada; o cliente acompanha o status (aguardando retirada / retirado / cancelado).

> 💡 **Observação:** produtos também podem ser adicionados **dentro de um pedido** de agendamento (seção 5), além da reserva avulsa aqui.

---

## 9. Perfil

### O que é
Dados pessoais do cliente e cadastro das crianças.

### Como usar
- **Dados pessoais** — editar **nome** e **telefone**, e enviar/trocar a **foto** de perfil.
- **Minhas crianças** — **Registrar criança** (nome, idade e foto) e **remover**. As crianças cadastradas aparecem para seleção quando o serviço é **infantil** (seção 5).
- **Sair** — encerrar a sessão.

> 💡 **Observação:** manter o **telefone** correto é importante, pois é por ele que chegam os avisos no **WhatsApp**.

---

## 10. Suporte

### O que é
Canal direto com a barbearia.

### Como usar
- Tocar em **Suporte** abre a conversa no **WhatsApp** da barbearia, já pronta para o cliente enviar a mensagem.

---

## 11. Avisos que o cliente recebe

Os avisos são enviados **automaticamente** (WhatsApp e, em alguns casos, e-mail). O cliente recebe mensagem quando:

- **Agendamento solicitado** — "recebemos seu pedido, aguardando confirmação".
- **Agendamento confirmado** — com serviço, valor, forma de pagamento e data/barbeiro.
- **Atendimento iniciado** — mensagem de boas-vindas com o serviço.
- **Atendimento finalizado** — agradecimento, lista de serviços/adicionais e **total pago**.
- **Assinatura** — solicitação recebida, **confirmação** (plano ativo) e **recusa** (quando não aprovada).
- **Cancelamentos** — assinatura, agendamento ou reserva de produto cancelados.

> 💡 **Observação:** quando o pedido é para uma **criança**, as mensagens de solicitação e confirmação incluem o **nome da criança**.

---

# PARTE 2 — PAINEL DO ADMIN

## 12. Acesso e navegação

### O que é
A área da equipe da barbearia.

### Como usar
- Entrar pela tela de **login do admin** (endereço `/admin/login`).
- **Menu lateral (sidebar)** com todas as áreas: **Dashboard, Solicitações, Agenda, Pedidos, Clientes, Serviços, Produtos, Barbeiros, Financeiro, Marketing, Mensagens, Configurações**.
- **Badge de Solicitações em tempo real** — quando chega um pedido novo, o número atualiza sozinho **e toca um som**; a lista também aparece na hora, sem recarregar.
- **Ver como cliente** — permite ao admin visualizar o app como um cliente (modo pré-visualização).
- **Sair** — logout.
- **Tema claro/escuro** e layout **responsivo no celular** (menu em formato hambúrguer).

---

## 13. Dashboard

### O que é
Visão rápida do dia e do mês.

### O que mostra
- **Indicadores**: faturamento do mês, agendamentos de hoje, assinantes ativos e pendências.
- **Agenda do dia** com os próximos atendimentos.

---

## 14. Solicitações

### O que é
A **fila de aprovações** da barbearia, em **tempo real**. Reúne três tipos de pedido.

### 1) Agendamentos (com cronômetro de 10 min)
- Cada card mostra cliente, serviço, data/hora, **itens e total a receber no local**, **forma de pagamento** e um **cronômetro de 10 minutos** para responder.
- Se o pedido é infantil, mostra **"Corte infantil para [nome]"**; se há **observações**, elas aparecem.
- Ações: **Aceitar** (confirma o horário) ou **Liberar horário** (recusa/expira).
- Botão **Avisar no WhatsApp** abre a conversa com a mensagem pronta.

### 2) Pedidos de plano
- **Nova assinatura**, **Troca de plano** ou **Cancelamento** → botões **Aprovar** / **Recusar**.
- Ao aprovar, o plano é ativado/alterado/cancelado e o cliente é avisado; ao recusar, o cliente também é avisado.

### 3) Reservas de produto
- Retiradas solicitadas pelos clientes → marcar como **entregue** ou **cancelar** (o cliente é avisado no cancelamento).

> 💡 **Observação:** qualquer novidade nessas três filas atualiza o **badge** e a lista **em tempo real** (com som).

---

## 15. Agenda

### O que é
A grade de horários da barbearia.

### Como usar
- Alternar entre visão **Dia** e **Semana** e navegar pelas **setas**.
- **Novo agendamento** — o admin marca direto para um cliente; nasce **confirmado** e, se for pelo plano, **consome 1 corte**.
- Tocar em um horário abre o detalhe (serviço, **criança**, **observações**, itens) com ações de **presença/falta/cancelar**.

> 💡 **Observação:** os horários disponíveis vêm dos **horários de trabalho** cadastrados em Barbeiros (seção 20).

---

## 16. Pedidos (comanda ao vivo)

### O que é
O atendimento em andamento — abrir a comanda do cliente, cronometrar e fechar a conta.

### Como usar
1. A tela lista os atendimentos de hoje (aguardando iniciar, em atendimento e finalizados).
2. **Iniciar atendimento** — dispara o **cronômetro** e envia um **WhatsApp de boas-vindas** ao cliente.
3. **Adicionar/remover itens** (serviços e produtos) na comanda ao vivo; o total e o tempo estimado se ajustam.
4. **Finalizar e lançar** — escolher a **forma de pagamento**; isso gera uma **venda no financeiro**, marca o atendimento como **concluído** e envia o **WhatsApp de agradecimento** (com a lista de serviços e o total pago).

> ⚠️ **Regra:** o item **coberto pelo plano** não é cobrado no fechamento (o corte já foi consumido na reserva). Só os **avulsos** entram no valor lançado.

---

## 17. Clientes

### O que é
O cadastro de clientes da barbearia.

### Como usar
- **Lista** com busca, **filtro de status** (todos/ativos/inativos) e a **coluna "Crianças"** (mostra quem tem filhos cadastrados).
- **Novo cliente** — cadastrar manualmente.
- **Convidar cliente** — gera um **convite** (link) para o cliente **definir a própria senha** e completar o cadastro.
- **Visualizar (olho)** — abre o detalhe do cliente:
  - Foto, status;
  - **Plano ativo** (nome + saldo de cortes) e a opção de **cancelar o plano** do cliente;
  - **Histórico de serviços**;
  - **Crianças** cadastradas (foto, nome, idade).
- **Atribuir combo** — o admin pode colocar um cliente em um plano diretamente.

---

## 18. Serviços e Planos

### O que é
Onde a barbearia gerencia o **catálogo de serviços** e os **planos (combos)**.

### Serviços
- **Criar/editar/inativar** serviços com: **nome, duração (min), preço, categoria** e o **switch "Serviço infantil"**.
- O switch **Serviço infantil** é o que faz aquele serviço, ao ser escolhido no app, pedir a **seleção/registro da criança** (seção 5). Na lista, esses serviços aparecem com o selo **"Infantil"**.

### Planos (combos)
- **Criar/editar/inativar** planos com: **nome, cortes por mês, escopo/benefícios e preço**.
- O texto de **escopo** é o que vira a lista de **benefícios** exibida ao cliente (adesão, desconto em produtos, etc.).

> 💡 **Observação:** preços usam **máscara de moeda** (R$) e são salvos corretamente.

---

## 19. Produtos (admin)

### O que é
Catálogo de produtos para venda/retirada.

### Como usar
- **Criar/editar/inativar** produtos com **preço, custo e estoque**.
- Os produtos aparecem para o cliente reservar (seção 8) e podem ser lançados nas comandas.

---

## 20. Barbeiros

### O que é
Equipe de profissionais e seus horários.

### Como usar
- **Criar/editar/inativar** barbeiros.
- **Horários de trabalho** — definir os dias e faixas de horário de cada barbeiro. **Isso alimenta os horários disponíveis** que o cliente vê ao agendar (seção 5) e a grade da Agenda (seção 15).

---

## 21. Financeiro

### O que é
Controle de entradas e saídas da barbearia.

### O que mostra / permite
- **Receitas e despesas** (as vendas lançadas nas comandas entram aqui).
- **Análise por forma de pagamento** (PIX, crédito, débito, dinheiro).
- **Registrar saque/retirada** do caixa.
- Fechamento e visão do mês.

---

## 22. Marketing

### O que é
Campanhas para os clientes (por segmento).

### Como usar
- Criar e enviar campanhas.

> 💡 **Observação:** este módulo é **condicionado ao plano da barbearia** (aparece **quando habilitado**). Se o item não estiver visível no menu, o recurso não faz parte do plano contratado.

---

## 23. Mensagens

### O que é
Modelos de mensagens de **WhatsApp** prontos para uso manual.

### Como usar
- Ver os modelos (boas-vindas, confirmação, retorno de clientes ausentes, aviso fora do expediente, etc.).
- Botão **Copiar** e link **wa.me** para enviar rapidamente ao cliente.

> 💡 **Observação:** os avisos automáticos (seção 25) são independentes desses modelos manuais.

---

## 24. Configurações

### O que é
Dados e identidade visual da barbearia.

### Como usar
- Ajustar **dados da unidade** e **horários**.
- **Identidade visual (branding)** — logo e cor de destaque da barbearia.

---

## 25. Avisos que o admin dispara

Vários avisos ao cliente saem **automaticamente** a partir de ações do admin:

- **Aceitar agendamento** → WhatsApp/e-mail de **confirmação**.
- **Iniciar atendimento** → WhatsApp de **boas-vindas**.
- **Finalizar atendimento** → WhatsApp de **agradecimento** (serviços + total).
- **Aprovar assinatura / troca** → **confirmação detalhada** do plano.
- **Recusar pedido de plano** → aviso de **não aprovado**.
- **Cancelar** assinatura, agendamento ou reserva → aviso de **cancelamento**.

Todos os envios ficam **registrados** internamente (log de notificações), com status enviado/pulado/falha.

> 💡 **Observação:** para os envios automáticos de WhatsApp funcionarem, é necessário que as credenciais de envio estejam configuradas e que o cliente tenha **telefone** no cadastro. Sem isso, o fluxo continua normal, mas o envio é apenas registrado como "pulado".

---

# ENCERRAMENTO

## 26. Regras de negócio (resumo)

- **Solicitação de agendamento expira em 10 minutos** se o admin não responder (o horário é liberado).
- **Saldo de cortes**: agendar pelo plano **consome 1 corte**; **cancelar devolve** o corte ao saldo. Renova no dia de cobrança.
- **Pagamento no local**, após o atendimento (PIX/crédito/débito/dinheiro).
- **Plano**: a **1ª mensalidade é o valor de adesão**; a partir do **2º mês**, o valor cheio. Assinar/trocar/cancelar **passa por aprovação** do admin.
- **Cancelamento pelo cliente**: pelo app com **no mínimo 10 minutos** de antecedência; imprevistos, pelo **WhatsApp** com até **30 minutos** antes.
- **Falta sem aviso** (no-show) pode **restringir** novos agendamentos.
- **Agendamento confirmado** não pode ser reagendado pelo cliente — apenas cancelado.

---

## 27. Glossário

- **Solicitação** — pedido (de agendamento ou de plano) que aguarda aprovação do admin.
- **Comanda / Pedido** — um agendamento com um ou mais itens (serviços e produtos).
- **Avulso** — item pago no local, fora do plano.
- **Coberto pelo plano** — item incluído no plano (não cobrado); consome saldo.
- **Adesão** — valor da 1ª mensalidade do plano.
- **Saldo (de cortes)** — quantidade de cortes disponíveis no mês para o assinante.
- **No-show** — falta sem aviso prévio.
- **Assinante** — cliente com plano ativo.
- **Entitlement** — recurso do painel liberado conforme o plano contratado pela barbearia (ex.: Marketing).

---

*Documento funcional — reflete o comportamento atual da plataforma. Telas e textos podem evoluir com novas versões.*
