# 0004 — Fila rápida: estado da jornada no servidor e credencial do aparelho

- Status: Proposto (aguarda revisão de segurança)
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
- **Credencial do aparelho**: valor aleatório gerado no servidor, entregue num cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`, com escopo **por barbearia** (um cookie por barbearia no mesmo aparelho). O banco guarda só o
  **resumo** (hash) da credencial, nunca o valor.
- Tabela de aparelhos (migration da #96, `schema-52`): resumo da credencial, barbearia, cliente resolvido
  (quando houver), criação, último uso, expiração. Validade de 30 dias, renovada a cada uso.
- **O navegador nunca envia nem recebe identificador de cliente ou de senha.** Toda ação da jornada recebe só
  o endereço da barbearia e os dados digitados; o servidor resolve o resto pela credencial.
- A credencial **não é sessão de conta**: dá acesso só ao que foi criado naquele aparelho naquela barbearia
  (a senha da fila e o passo atual). Não abre o app do cliente, histórico, plano nem dados de outra barbearia.
- Escrita só por funções de banco próprias da fila rápida, executadas com `service_role`, conferindo dentro da
  função que barbearia, aparelho e cliente pertencem um ao outro.
- A credencial é a âncora dos limites da #99 (por aparelho), somada aos limites por telefone e aos tetos por
  barbearia (emissão de credencial nova conta no teto por hora da barbearia).

## Consequências
- Revogação simples (apagar ou expirar a linha) e limites no mesmo lugar.
- Uma tabela nova com RLS e uma leitura extra por passo; custo aceitável no volume de uma barbearia.
- Limpar o cookie ou trocar de navegador gera um aparelho novo: contra volume, os limites por aparelho não
  bastam sozinhos; por isso os tetos por barbearia são obrigatórios (#99).
- Quem tem o aparelho na mão vê a senha criada nele. É o mesmo que o papel da senha no balcão; nada além disso.
- Revisão de segurança obrigatória (Navalha) na migration e nas actions.
