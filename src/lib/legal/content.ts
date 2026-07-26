/**
 * Conteúdo dos documentos legais (fiel aos .docx da Barbearia Oliveira 01).
 * White-label: por ora fixo; futuramente por tenant.
 */

export const LEGAL_CONTACT = {
  whatsapp: "(21) 99088-3359",
  whatsappLink: "https://wa.me/5521990883359",
  instagram: "@oliveira_01_barbearia",
  updatedAt: "20 de julho de 2026",
};

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  intro: string;
  sections: LegalSection[];
}

export const TERMS: LegalDocument = {
  title: "Termos de Uso",
  subtitle: "Barbearia Oliveira 01",
  intro:
    "Bem-vindo à nossa plataforma de agendamentos. Ao reservar um horário, você concorda com as regras de funcionamento da nossa barbearia descritas abaixo.",
  sections: [
    {
      title: "1. Como funciona o agendamento",
      paragraphs: [
        "A plataforma serve para você escolher o serviço e o horário de sua preferência.",
        "O cadastro deve ser feito com informações corretas e atualizadas (nome completo, data de nascimento, telefone e e-mail).",
      ],
    },
    {
      title: "2. Compromisso com o horário",
      paragraphs: [
        "O cliente deve comparecer à barbearia no horário exato agendado.",
        "Atrasos toleráveis dependem da disponibilidade, mas podem resultar no cancelamento do atendimento para não atrasar o próximo cliente.",
      ],
    },
    {
      title: "3. Regras para cancelamento",
      paragraphs: [
        "Se você precisar cancelar o seu atendimento, o prazo mínimo permitido pelo sistema é de 10 minutos de antecedência.",
      ],
    },
    {
      title: "4. Regras para imprevistos e faltas (no-show)",
      paragraphs: [
        "Caso mude de ideia ou tenha um imprevisto em cima da hora, você deve nos enviar um aviso prévio de até 30 minutos antes do atendimento.",
        "O não comparecimento sem aviso prévio poderá gerar restrições para agendamentos futuros na plataforma.",
      ],
    },
    {
      title: "5. Alterações nas regras",
      paragraphs: [
        "A Barbearia Oliveira 01 pode atualizar estas regras de funcionamento sempre que necessário.",
        "As novas regras passam a valer assim que publicadas na plataforma.",
      ],
    },
    {
      title: "6. Canais de suporte",
      paragraphs: [
        `Se tiver qualquer dúvida sobre o seu agendamento ou precisar de ajuda, entre em contato: WhatsApp ${LEGAL_CONTACT.whatsapp} · Instagram ${LEGAL_CONTACT.instagram}.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Política de Privacidade",
  subtitle: "Barbearia Oliveira 01",
  intro:
    "Este documento explica como a Barbearia Oliveira 01 coleta, utiliza, armazena e protege os dados pessoais dos clientes na plataforma de agendamento, em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).",
  sections: [
    {
      title: "1. Dados coletados e finalidade (Art. 7º, V da LGPD)",
      paragraphs: [
        "Dados de cadastro: nome completo, número de telefone/WhatsApp e e-mail.",
        "Finalidade contratual: a coleta desses dados é requisito estritamente necessário para a execução do contrato de prestação de serviços (gerenciamento, confirmação, controle de faltas e histórico de agendamentos).",
        "Dados técnicos: podem ser coletados registros de acesso (IP, data e hora) para cumprimento do Marco Civil da Internet (Lei nº 12.965/2014).",
      ],
    },
    {
      title: "2. Base legal para o tratamento",
      paragraphs: [
        "O tratamento dos seus dados é fundamentado na execução de contrato ou procedimentos preliminares (Art. 7º, V da LGPD) e no legítimo interesse do controlador (Art. 7º, IX da LGPD) para garantir a segurança do negócio e evitar fraudes no agendamento.",
      ],
    },
    {
      title: "3. Armazenamento e segurança dos dados",
      paragraphs: [
        "Os dados são armazenados em nuvem, em servidores seguros com criptografia e controle restrito de acesso.",
        "Adotamos medidas técnicas de segurança para impedir acessos não autorizados, vazamentos, perda ou alteração dos dados.",
      ],
    },
    {
      title: "4. Compartilhamento de dados com terceiros",
      paragraphs: [
        "A Barbearia Oliveira 01 não vende e não comercializa seus dados pessoais.",
        "O compartilhamento ocorre única e exclusivamente com a empresa parceira desenvolvedora da plataforma de agendamento (operadora dos dados), submetida a rígidas cláusulas contratuais de confidencialidade.",
      ],
    },
    {
      title: "5. Retenção e término do tratamento",
      paragraphs: [
        "Seus dados permanecerão armazenados enquanto você mantiver seu perfil ativo na plataforma.",
        "Em caso de inatividade prolongada ou mediante solicitação expressa de exclusão, os dados serão eliminados definitivamente, exceto aqueles necessários para o cumprimento de obrigações legais ou fiscais.",
      ],
    },
    {
      title: "6. Direitos do titular dos dados (Art. 18 da LGPD)",
      paragraphs: [
        "Você pode solicitar, a qualquer momento, pelos nossos canais oficiais: confirmação da existência de tratamento e acesso aos seus dados; correção de dados incompletos, inexatos ou desatualizados; eliminação dos dados pessoais (exceto os guardados por obrigação legal); e revogação do consentimento para recebimento de mensagens promocionais.",
      ],
    },
    {
      title: "7. Canal de atendimento",
      paragraphs: [
        `Para exercer seus direitos ou tirar dúvidas sobre a sua privacidade, fale com a nossa administração: WhatsApp ${LEGAL_CONTACT.whatsapp} · Instagram ${LEGAL_CONTACT.instagram}.`,
      ],
    },
  ],
};
