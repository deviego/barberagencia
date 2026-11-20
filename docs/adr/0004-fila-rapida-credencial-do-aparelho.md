# 0004 — Fila rápida: estado da jornada no servidor e credencial do aparelho

- Status: Aceito (segurança: Navalha, 2026-11-20, com a emenda das exceções 1 e 2)
- Stories: #96 (nasce aqui), #98, #99, #101 · Epic #94
- Autor: Alicerce (Tech Lead)

## Contexto
A fila rápida deixa o cliente pegar senha pelo link da barbearia sem criar conta antes: telefone → nome (se
novo) → serviço → senha → "Minha senha". São vários passos e várias requisições, todas vindas de um navegador
sem sessão de conta. O servidor precisa saber, a cada passo, **qual cliente** já foi resolvido e **qual senha**
pertence a quem está olhando, sem que o navegador possa trocar esse vínculo.

Opções consideradas:
1. **Estado no navegador, assinado** (token com o id do cliente). Simples, sem tabela nova. Mas o navegador
   passa a carregar um identificador de cliente; não há como revogar um token antes de expirar; e cada limite
   (por aparelho, por telefone) precisaria de um segundo mecanismo no servidor de qualquer forma.
2. **Sessão de conta (login) silenciosa.** Mistura a jornada sem conta com o login real do cliente e amplia o
   que um navegador sem prova de posse do telefone consegue acessar.
3. **Estado no servidor, preso a uma credencial do aparelho.** Escolhida.

## Decisão
- **Credencial do aparelho**: valor aleatório de 256 bits gerado no servidor, entregue num cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`, com escopo **por barbearia** (um cookie por barbearia no mesmo aparelho). O banco guarda só o
  **resumo** (sha256) da credencial, nunca o valor.
- Tabela de aparelhos (migration da #96, `schema-52`): resumo da credencial, barbearia, cliente resolvido
  (quando houver), criação, último uso, expiração. Validade de 30 dias, renovada a cada uso.
  **A tabela não guarda telefone nem chave de telefone**, salvo a exceção 1 abaixo.
- **O navegador nunca envia nem recebe identificador de cliente ou de senha.** Toda ação da jornada recebe só
  o endereço da barbearia e os dados digitados; o servidor resolve o resto pela credencial.
- A credencial **não é sessão de conta**: dá acesso só ao que foi criado naquele aparelho naquela barbearia
  (a senha da fila e o passo atual). Não abre o app do cliente, histórico, plano nem dados de outra barbearia.
- **Regra geral:** o aparelho só fica ligado a um cliente criado naquele aparelho, salvo a exceção 2 abaixo.
  Toda tela e ação da jornada filtra pela **senha criada no aparelho**, nunca pelo cliente ligado a ele.
- Escrita só por funções de banco próprias da fila rápida, executadas com `service_role`, conferindo dentro da
  função que barbearia, aparelho e cliente pertencem um ao outro.
- A credencial é a âncora dos limites por aparelho (#99), somados aos tetos por barbearia (emissão de credencial
  nova conta no teto por hora da barbearia). **Não há limite por telefone nem por rede** nesta fase; qualquer
  limite novo entra pela #99 e é registrado aqui por emenda.

## Exceções (emenda, sujeita à aprovação da segurança)
1. **Telefone pendente entre dois passos.** Quando o telefone é novo, a chave do telefone fica na linha do
   aparelho (`pending_phone_key`, `pending_until`) por no máximo **10 minutos**, só para que o passo do nome não
   precise receber o telefone de novo. É apagada quando o nome é registrado, quando o aparelho identifica outro
   telefone, quando vence (a limpeza roda antes de qualquer outra checagem, inclusive com a fila rápida
   desligada) e pela rotina de retenção (#108). Nunca vai para a tabela de tentativas nem para log.
2. **Telefone já cadastrado.** Digitar um telefone já cadastrado na barbearia liga o aparelho ao cliente
   existente, **sem prova de posse do número**. Por isso esse vínculo nunca mostra nome, histórico ou plano,
   nunca gasta corte de plano (#100) e só serve para criar e acompanhar a senha feita naquele aparelho.
   Requisito obrigatório nas revisões da #97 e da #98.

## Consequências
- Revogação simples (apagar ou expirar a linha) e limites no mesmo lugar.
- Uma tabela nova com RLS e uma leitura extra por passo; custo aceitável no volume de uma barbearia.
- Limpar o cookie ou trocar de navegador gera um aparelho novo: contra volume, os limites por aparelho não
  bastam sozinhos; por isso os tetos por barbearia são obrigatórios (#99).
- Quem tem o aparelho na mão vê a senha criada nele. É o mesmo que o papel da senha no balcão; nada além disso.
- O fluxo revela se um telefone já é cliente da barbearia (pede o nome ou não). Aceito como decisão de produto;
  o volume de consultas é contido pelos tetos por barbearia e pelo freio que a #99 vai definir.
- A mesma migration garante **um cliente por telefone por barbearia** no banco (índice único e gatilho em
  `clients`, para todos os caminhos de cadastro). Decisão difícil de reverter, registrada aqui.
- Retenção: tentativas, credenciais vencidas e telefones pendentes vencidos são apagados pela rotina da #108
  (aguarda OK do Diego). Nenhuma barbearia real liga a fila rápida antes de a rotina existir.
- Revisão de segurança obrigatória (Navalha) na migration e nas actions.
