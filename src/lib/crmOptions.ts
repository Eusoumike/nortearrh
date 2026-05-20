// Opções compartilhadas do módulo CRM (negócios, clientes, atividades)

export const PLANO_OPTIONS = [
  "Essencial",
  "Gerencial",
  "Profissional",
  "Corporativo",
  "Gratuito",
  "Multi VR+VA",
  "Multi Mobilidade",
];

export const EXTENSAO_OPTIONS = ["RF", "API", "WhatsApp", "Férias e Folga", "Escala"];

export const QUEM_IMPLANTA_OPTIONS = ["Time VR", "Parceiro"];

export const MOTIVO_PERDA_OPTIONS = [
  "Cadastro inválido",
  "Concorrente",
  "Desinteresse",
  "Fora do perfil",
  "Free",
  "Impossível contato",
  "Inconformidade Legal",
  "Já é cliente Pontomais",
  "Modelo Convencional",
  "Não qualificado",
  "Produto",
  "Cancelamento",
  "Encerramento de atividades",
];

export const CANAL_ORIGEM_OPTIONS = [
  "Apollo",
  "Instagram",
  "Site",
  "TikTok",
  "Indicação",
  "Eventos",
  "WhatsApp",
  "Migração VR",
  "Outros",
];

export const FAIXA_COLABORADORES_OPTIONS = [
  "1 a 10",
  "11 a 25",
  "26 a 50",
  "51 a 100",
  "101 a 150",
  "151 a 200",
  "201 a 250",
  "251+",
];

export const ETIQUETA_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "quente", label: "Lead quente", emoji: "🔥" },
  { value: "morno", label: "Lead morno", emoji: "🌡" },
  { value: "frio", label: "Lead frio", emoji: "❄" },
  { value: "perdido", label: "Perdido", emoji: "✖" },
];

export const SEGMENTO_OPTIONS = [
  "Indústria",
  "Comércio e Varejo",
  "Saúde e Bem-estar",
  "Construção Civil",
  "Alimentação e Bebidas",
  "Educação",
  "Serviços",
  "Software/TI",
  "Outros",
];

export const ESTADO_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const ORIGEM_LEAD_OPTIONS = [
  "Indicação de Cliente Ativo",
  "Indicação Pontomais",
  "Instagram",
  "Site",
  "TikTok",
  "Eventos",
  "Prospecção Outbound",
  "Migração VR",
  "Outros",
];

export const PROBABILIDADE_OPTIONS = ["Baixa", "Média", "Alta"];

export const PAPEL_OPTIONS = [
  { value: "gestor_rh", label: "Gestor de RH" },
  { value: "responsavel_implantacao", label: "Responsável Implantação" },
  { value: "socio", label: "Sócio" },
  { value: "socio_administrador", label: "Sócio-administrador" },
  { value: "contador", label: "Contador" },
  { value: "colaborador", label: "Colaborador" },
];

export const ATIVIDADE_TIPOS: { value: string; label: string; emoji: string }[] = [
  { value: "ligacao", label: "Ligação", emoji: "📞" },
  { value: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { value: "reuniao", label: "Reunião", emoji: "🤝" },
  { value: "email", label: "E-mail", emoji: "✉️" },
  { value: "demo", label: "Demo", emoji: "🖥" },
  { value: "anotacao", label: "Anotação", emoji: "📝" },
];

export const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

export const STATUS_NORTEAR_OPTIONS: { value: string; label: string; emoji: string; color: string }[] = [
  { value: "ativo_saudavel", label: "Ativo saudável", emoji: "🟢", color: "bg-green-100 text-green-800" },
  { value: "em_risco", label: "Em risco", emoji: "🟡", color: "bg-yellow-100 text-yellow-800" },
  { value: "risco_cancelamento", label: "Risco cancelamento", emoji: "🔴", color: "bg-red-100 text-red-800" },
  { value: "inativo", label: "Inativo", emoji: "⚫", color: "bg-gray-200 text-gray-800" },
  { value: "upsell", label: "Upsell", emoji: "🔵", color: "bg-blue-100 text-blue-800" },
];

export const FORNECEDOR_BENEFICIOS_OPTIONS = [
  "Alelo","Flash","Ticket","Pluxee/Sodexo","Vale","Caju","Ifood","Não possui","Não paga benefícios","Outros",
];

export const FORNECEDOR_RH_DIGITAL_OPTIONS = [
  "Ahgora","Factorial","Genyo","Oitchau","Marqponto","Tangerino","Não possui","Realiza internamente","Outros",
];

export const MODULOS_ATIVOS_OPTIONS = [
  "VR","VA","Multi VR+VA","Mobilidade","Essencial","Gerencial","Profissional","Corporativo",
];

export const POTENCIAL_CROSS_OPTIONS = ["Benefícios", "RH"];

export const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  contato: "Contato",
  apresentacao: "Apresentação",
  negociacao: "Negociação",
  fechado_ganho: "Fechado Ganho",
  fechado_perdido: "Fechado Perdido",
};

export const fmtBRL = (n: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
