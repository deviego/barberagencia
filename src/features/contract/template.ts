import {
  PLATFORM_NAME,
  CONTRACT_FORO,
  DEFAMATION_FINE,
  DEVELOPERS,
} from "./parties";

/** Dados do ASSINANTE (barbearia) que preenchem o contrato. */
export type ContractFields = {
  tradeName?: string | null; // nome fantasia
  legalName?: string | null; // razão social
  docType?: string | null; // CNPJ | CPF
  docNumber?: string | null;
  responsibleName?: string | null;
  responsibleCpf?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  planLabel?: string | null;
};

export type ContractSection = { n: string; title: string; paragraphs: string[] };

const BLANK = "________________";
const v = (s?: string | null) => (s && s.trim() ? s.trim() : BLANK);

/** Linha de endereço completa do ASSINANTE. */
export function assinanteAddress(f: ContractFields): string {
  const parts = [
    f.addressStreet,
    [f.addressCity, f.addressState].filter(Boolean).join("/"),
    f.addressZip ? `CEP: ${f.addressZip}` : null,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(", ") : BLANK;
}

/** Identificação do ASSINANTE para o preâmbulo (nome + documento). */
export function assinanteHeading(f: ContractFields): string {
  const nome = f.tradeName || f.legalName;
  const doc = f.docNumber ? `${f.docType || "CNPJ/CPF"}: ${f.docNumber}` : `${f.docType || "CNPJ/CPF"}: ${BLANK}`;
  return `${v(nome)}, inscrita no ${doc}, com sede em ${assinanteAddress(f)}`;
}

/**
 * Monta o contrato completo (fiel ao documento), com os dados do ASSINANTE preenchidos.
 * Retorna as seções para renderização + o preâmbulo das partes.
 */
export function buildContract(f: ContractFields): {
  title: string;
  parties: string[];
  sections: ContractSection[];
} {
  const devs = DEVELOPERS.map(
    (d) => `${d.name}, inscrito no CPF: ${d.cpf}, residente e domiciliado em ${d.city}${d.cep ? `, CEP: ${d.cep}` : ""}`
  );

  const parties = [
    `De um lado, ${devs.join(", e ")}; responsáveis e desenvolvedores da plataforma digital doravante denominada simplesmente ${PLATFORM_NAME}.`,
    `De outro lado, ${assinanteHeading(f)}, de agora em diante denominada ASSINANTE.`,
    f.planLabel ? `Plano contratado: ${f.planLabel}.` : "",
  ].filter(Boolean);

  const sections: ContractSection[] = [
    {
      n: "1",
      title: "Objeto do Contrato e Licença de Uso",
      paragraphs: [
        `O presente contrato tem por objeto a licença de uso do software de agendamento online e gestão, de propriedade exclusiva da ${PLATFORM_NAME} e seus respectivos responsáveis e desenvolvedores, disponibilizado em formato de assinatura.`,
        `Licenças de Terceiros: A ${PLATFORM_NAME} utiliza e integra ferramentas, sublicenças e serviços de infraestrutura de empresas parceiras intermediada e moderada exclusivamente pelos seus responsáveis (tais como servidores de hospedagem em nuvem, gateways de pagamento, APIs de mapas e integradores de mensagens/WhatsApp).`,
        `O ASSINANTE declara estar ciente de que o funcionamento da plataforma depende da estabilidade dessas ferramentas de terceiros contratadas pela desenvolvedora.`,
      ],
    },
    {
      n: "3",
      title: "Dos Planos, Pagamentos e Alterações de Serviços",
      paragraphs: [
        `O ASSINANTE escolherá o plano tarifário no momento do cadastro${f.planLabel ? ` (plano contratado: ${f.planLabel})` : ""}.`,
        `O atraso no pagamento da assinatura por mais de 30 dias resultará na suspensão automática do acesso ao sistema.`,
        `Alteração de Plano Sem Burocracia (Upgrade/Downgrade): Fica expressamente autorizado que o ASSINANTE mude de plano, adicione ou remova recursos contratados diretamente pelo painel administrativo da plataforma. Essa alteração ocorrerá de forma digital e automática, sem a necessidade de assinatura de um novo termo ou aditivo contratual, passando a valer o novo valor na fatura seguinte ou de forma proporcional.`,
        `A ${PLATFORM_NAME} poderá reajustar os valores dos planos anualmente mediante aviso prévio de 30 dias.`,
      ],
    },
    {
      n: "4",
      title: "Integrações de Ferramentas Contábeis e Tecnológicas Adicionais",
      paragraphs: [
        `O ASSINANTE declara compreender que serviços externos como emissão de notas fiscais eletrônicas, relatórios avançados de pagamento e configurações personalizadas de webhooks ou APIs são de livre contratação.`,
        `A ${PLATFORM_NAME} fornece a compatibilidade tecnológica para tais integrações, porém os custos, assinaturas e obrigações legais com essas ferramentas contábeis ou de terceiros são de responsabilidade financeira exclusiva do ASSINANTE.`,
      ],
    },
    {
      n: "5",
      title: "Das Responsabilidades da ASSINANTE",
      paragraphs: [
        `O ASSINANTE é o único responsável pelas regras de cancelamento, preços, serviços cadastrados e pelo atendimento final prestado ao cliente.`,
      ],
    },
    {
      n: "6",
      title: "Do Suporte Técnico e Regras para Chamados",
      paragraphs: [
        `A ${PLATFORM_NAME} oferece suporte técnico para a correção de falhas e esclarecimento de dúvidas sobre o sistema de agendamentos.`,
        `Chamados Cancelados ou Encerrados: Os chamados abertos pelo ASSINANTE poderão ser cancelados ou encerrados automaticamente pela equipe técnica da ${PLATFORM_NAME} caso: (a) o ASSINANTE não envie as informações solicitadas para a resolução do problema no prazo de 3 dias corridos; (b) seja constatado que o problema relatado decorre de erro do próprio usuário, falha na internet local do estabelecimento ou mau uso do dispositivo móvel/computador.`,
        `Isenção de Responsabilidade por Serviços de Terceiros: A ${PLATFORM_NAME} não será responsabilizada por instabilidades técnicas, manutenções emergenciais ou quedas de sinal geradas exclusivamente pelas empresas fornecedoras de infraestrutura terceirizada.`,
      ],
    },
    {
      n: "7",
      title: "Dos Direitos Autorais e Propriedade Intelectual",
      paragraphs: [
        `Todos os direitos autorais, segredos de negócio, códigos-fonte, estruturas de banco de dados, design de interface e marcas associadas pertencem exclusivamente à ${PLATFORM_NAME}.`,
        `A contratação da assinatura não transfere ao ASSINANTE nenhum direito de propriedade sobre o software.`,
        `É expressamente proibida qualquer tentativa de engenharia reversa, cópia de layout, sublicenciamento não autorizado ou modificação da plataforma, sob pena de processo judicial civil e criminal.`,
      ],
    },
    {
      n: "8",
      title: "Do Uso do Nome Comercial e Logotipo (Portfólio)",
      paragraphs: [
        `O ASSINANTE autoriza, de forma gratuita e sem direito a indenizações, o uso do seu nome comercial, marca e logotipo para fins de divulgação da ${PLATFORM_NAME}.`,
        `Essa utilização restringe-se à exibição em portfólios, materiais publicitários, site oficial da desenvolvedora e redes sociais, com o intuito único de demonstrar que a barbearia é cliente e usuária do sistema, sendo vedado o uso de fotos ou dados privados sem autorização prévia por escrito.`,
      ],
    },
    {
      n: "9",
      title: "Da Regularidade Documental e Uso de Terceiros (Cláusula de Fraude)",
      paragraphs: [
        `O ASSINANTE declara que todos os dados fornecidos no cadastro (CNPJ, CPF, Nome Fantasia e dados bancários) são próprios, legítimos e verídicos.`,
        `É expressamente proibido o uso de documentação irregular, falsa ou de terceiros sem a devida autorização legal.`,
        `A descoberta de qualquer fraude documental resultará na rescisão imediata do contrato, sem direito a reembolso, além do envio dos dados às autoridades competentes para apuração de crime de falsidade ideológica. Artigo 475 do Código Civil: estabelece que a parte lesada pelo inadimplemento (neste caso, a quebra de confiança e o ato ilícito da fraude documental) pode pedir a resolução do contrato.`,
      ],
    },
    {
      n: "10",
      title: "Cláusula de Mau Uso, Abuso do Sistema e Antidifamação",
      paragraphs: [
        `Parágrafo Primeiro (Obrigatoriedade de Conduta Lícita): O ASSINANTE compromete-se a utilizar a plataforma estritamente para fins lícitos de agendamento e gestão de seu negócio, sendo vedado o uso do sistema para fraudes, assédio, disparos em massa não autorizados (SPAM) ou violação de direitos autorais.`,
        `Parágrafo Segundo (Proibição Absoluta de Difamação): É expressamente proibido ao ASSINANTE utilizar canais próprios, redes sociais, mídias públicas, sites de reclamação (como Reclame Aqui), fóruns ou qualquer outro meio de comunicação para proferir declarações infundadas, caluniosas, difamatórias ou injuriosas com o objetivo de lesionar a imagem, a honra, a reputação ou o nome comercial da ${PLATFORM_NAME} ou de seus responsáveis.`,
        `Parágrafo Terceiro (Fundamentação Legal): A prática de atos que ataquem a reputação da plataforma sujeitará o ASSINANTE às penalidades previstas nos Artigos 138, 139 e 140 do Código Penal Brasileiro (Crimes de Calúnia, Difamação e Injúria), bem como ao dever de reparação integral estabelecido nos Artigos 186, 187 e 927 do Código Civil Brasileiro (Responsabilidade Civil por Ato Ilícito e Abuso de Direito que causam Danos Morais à Pessoa Jurídica).`,
        `Parágrafo Quarto (Das Sanções e da Multa por Quebra de Contrato): A constatação de qualquer conduta difamatória ou injuriosa por parte do ASSINANTE resultará cumulativamente em: (a) bloqueio permanente e imediato de todas as credenciais de acesso à plataforma; (b) rescisão por justa causa do presente contrato, sem direito a qualquer tipo de reembolso ou restituição de valores já pagos; (c) aplicação de multa contratual punitiva e indenizatória imediata no valor fixado de ${DEFAMATION_FINE} por infração cometida, sem prejuízo de eventuais perdas e danos e lucros cessantes que venham a ser apurados judicialmente caso o impacto financeiro da difamação seja superior a este valor.`,
      ],
    },
    {
      n: "11",
      title: "Da Responsabilidade e Sanções perante a LGPD",
      paragraphs: [
        `Divisão de Papéis: O ASSINANTE atua como Controlador (responsável pelas decisões sobre os dados dos clientes) e a ${PLATFORM_NAME} atua como Operadora (apenas armazena e processa a tecnologia).`,
        `O ASSINANTE obriga-se a tratar os dados pessoais dos seus clientes em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).`,
        `Direito de Regresso: Caso a ${PLATFORM_NAME} seja processada ou multada judicialmente por um erro, abuso ou mau uso de dados cometido pelo ASSINANTE, esta deverá ressarcir integralmente a ${PLATFORM_NAME} por todos os custos gerados.`,
      ],
    },
    {
      n: "12",
      title: "Das Sanções Contratuais Gerais",
      paragraphs: [
        `A violação de qualquer cláusula de segurança, LGPD, direitos autorais, difamação ou fraude documental dará à ${PLATFORM_NAME} e seus representantes o direito de aplicar as seguintes sanções ao ASSINANTE: (a) notificação de advertência por escrito; (b) suspensão temporária do acesso à plataforma; (c) bloqueio definitivo e rescisão imediata do contrato, com perda dos valores já pagos e aplicação de multa contratual estipulada em até 03 vezes o valor da assinatura vigente.`,
      ],
    },
    {
      n: "13",
      title: "Rescisão Padrão",
      paragraphs: [
        `O contrato poderá ser cancelado a qualquer momento por iniciativa do ASSINANTE (desde que não esteja em cumprimento de sanção), garantido o acesso até o final do período já pago.`,
      ],
    },
    {
      n: "",
      title: "Do Aceite e Assinatura Eletrônica",
      paragraphs: [
        `Por estarem assim justas e contratadas, as partes declaram que compreendem e aceitam todas as cláusulas e condições deste instrumento.`,
        `O ASSINANTE manifesta sua concordância integral e irrevogável no momento em que seleciona a opção "Li e aceito os Termos de Uso e Contrato de Assinatura" na plataforma, gerando um registro digital que serve como assinatura eletrônica vinculante para todos os fins de direito, nos termos do Artigo 10, § 2º da Medida Provisória nº 2.200-2/2001.`,
        `Fica eleito o foro da comarca da sede da ${PLATFORM_NAME} (${CONTRACT_FORO}) para dirimir qualquer dúvida ou litígio decorrente deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`,
      ],
    },
  ];

  return { title: `Contrato de Prestação de Serviços e Assinatura ${PLATFORM_NAME}`, parties, sections };
}

/** Versão texto puro do contrato — para snapshot e hash (prova da assinatura). */
export function contractPlainText(f: ContractFields): string {
  const { title, parties, sections } = buildContract(f);
  const lines: string[] = [title, "", "DAS PARTES", ...parties, ""];
  for (const s of sections) {
    lines.push(`${s.n ? `${s.n}. ` : ""}${s.title}`);
    for (const p of s.paragraphs) lines.push(p);
    lines.push("");
  }
  return lines.join("\n");
}
