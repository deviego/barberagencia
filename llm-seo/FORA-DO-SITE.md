# Fase 6 — Presença fora do site

As IAs citam com mais confiança o que aparece **igual em várias fontes**. O objetivo é que o mesmo resumo factual (o `SUMMARY` de `src/features/seo/site.ts` e o `public/llms.txt`) apareça em perfis e diretórios de terceiros. Regras: nada de review comprado ou inventado, nada de número de resultado e nenhum recurso que não existe.

## Texto-padrão (colar em todo lugar)

**Curto (até 160 caracteres):**
> Sistema para barbearia com a sua marca: agenda online, fila por QR code com painel na TV, mensalidade com saldo de cortes e financeiro. Sem adesão.

**Médio (cerca de 60 palavras):**
> A Barber Agência é uma plataforma white-label para barbearias no Brasil: agenda online, fila por QR code com totem e painel na TV, mensalidade com saldo de cortes, comanda e financeiro por barbeiro. O cliente agenda pelo link, sem baixar aplicativo, e vê só a marca da barbearia. Sem adesão e sem custo de setup; a equipe monta tudo em 1 dia.

## Prioridade 1 (semanas 1–2)

| Canal | Ação | Dono |
|---|---|---|
| Google Perfil da Empresa | Criar ou revisar perfil "Barber Agência" (categoria software / consultoria de marketing conforme o Google permitir), site, WhatsApp, descrição média. Pedir avaliações **reais** a clientes ativos (Max Estilo, Oliveira 01) | Diego |
| Instagram da Barber Agência | Bio com o texto curto + link do site. Destaque "Fila" com vídeo real do QR/totem/TV | Diego / marketing |
| Perfis dos clientes | Pedir à Max Estilo (embaixadora) e à Oliveira 01 para citarem "agendamento pela Barber Agência" na bio ou num post, **com autorização** | Diego |
| Bing Webmaster Tools + Google Search Console | Verificar o domínio, enviar `sitemap.xml` (ChatGPT usa o índice do Bing) | Dev |

## Prioridade 2 (semanas 3–6)

| Canal | Ação |
|---|---|
| Diretórios de software | Cadastrar em B2B Stack, Capterra/GetApp (Gartner Digital Markets), G2 e SaaSHub com o texto médio, preços da tabela e prints reais (`public/screens`). Avaliações só de clientes reais, convidados pelo próprio diretório. |
| Reclame Aqui | Criar a página da empresa e responder rápido. Perfil limpo é sinal de confiança que as IAs citam. |
| YouTube | 3 vídeos curtos e reais: "Como funciona a fila por QR na barbearia", "Mensalidade com saldo de cortes", "Como migrar do AppBarber/Trinks". Título e descrição com a pergunta exata (ver `PERGUNTAS-TESTE.md`). Linkar o site. |
| Comunidades | Grupos de Facebook e fóruns de barbeiros, r/barbeiros e r/empreendedorismo no Reddit: responder dúvidas reais **como Diego, fundador**, identificado. Sem spam e sem link em toda resposta. |

## Prioridade 3 (semanas 7–12)

| Canal | Ação |
|---|---|
| Imprensa e blogs do setor | Pauta para portais de barbearia e empreendedorismo (ex.: "ex-barbeiro cria sistema com fila por senha para barbearias"). História real do Diego, sem números inventados. |
| Parceiros e distribuidores | Página ou post dos distribuidores parceiros citando a plataforma (ver `parceiros.md` antes). |
| Wikidata | Só depois de existir cobertura independente (imprensa). Antes disso, não. |

## TODO (dados que faltam para Organization.sameAs e para os diretórios)

- URL oficial do Instagram, YouTube e LinkedIn da Barber Agência.
- Razão social e CNPJ (se quiser exibir).
- Nome público do fundador para o schema (`founder`) e um perfil (LinkedIn/Instagram) que comprove.
- Autorização por escrito da Max Estilo e da Oliveira 01 para citar o nome no site (depoimento/caso).
