/**
 * Configuração do Cliente (Tenant)
 * 
 * Este arquivo centraliza todas as configurações específicas do cliente.
 * Para cada novo deploy, basta alterar as variáveis de ambiente ou este arquivo.
 */

export interface ClientConfig {
  // Identificação
  id: string;
  name: string;
  shortName: string;
  
  // Contato
  phone: string;
  whatsappBusinessName: string;
  email?: string;
  website?: string;
  
  // Endereço
  address?: string;
  city?: string;
  state?: string;
  
  // Horário de atendimento
  businessHours: {
    weekdays: string;
    saturday?: string;
    sunday?: string;
  };
  
  // Configurações do bot
  botConfig: {
    // Nome da assistente virtual
    assistantName: string;
    // Tom de voz (formal, informal, etc.)
    tone: 'formal' | 'informal' | 'professional';
    // Emoji no início das mensagens
    useEmojis: boolean;
  };
  
  // URLs
  urls: {
    inventory?: string;
    privacyPolicy?: string;
    termsOfService?: string;
  };
  
  // Vendedor para handoff
  salesTeam: {
    name: string;
    phone: string;
    email?: string;
  };
}

/**
 * Carrega configuração do cliente a partir de variáveis de ambiente
 */
function loadClientConfig(): ClientConfig {
  return {
    // Identificação
    id: process.env.CLIENT_ID || 'default',
    name: process.env.CLIENT_NAME || 'FaciliAuto',
    shortName: process.env.CLIENT_SHORT_NAME || 'FaciliAuto',
    
    // Contato
    phone: process.env.CLIENT_PHONE || '',
    whatsappBusinessName: process.env.CLIENT_WHATSAPP_NAME || 'FaciliAuto',
    email: process.env.CLIENT_EMAIL,
    website: process.env.CLIENT_WEBSITE,
    
    // Endereço
    address: process.env.CLIENT_ADDRESS,
    city: process.env.CLIENT_CITY || 'São Paulo',
    state: process.env.CLIENT_STATE || 'SP',
    
    // Horário de atendimento
    businessHours: {
      weekdays: process.env.CLIENT_HOURS_WEEKDAYS || 'Segunda a Sexta, 9h às 18h',
      saturday: process.env.CLIENT_HOURS_SATURDAY || 'Sábado, 9h às 13h',
      sunday: process.env.CLIENT_HOURS_SUNDAY,
    },
    
    // Configurações do bot
    botConfig: {
      assistantName: process.env.BOT_ASSISTANT_NAME || 'assistente virtual',
      tone: (process.env.BOT_TONE as 'formal' | 'informal' | 'professional') || 'professional',
      useEmojis: process.env.BOT_USE_EMOJIS !== 'false',
    },
    
    // URLs
    urls: {
      inventory: process.env.CLIENT_INVENTORY_URL,
      privacyPolicy: process.env.CLIENT_PRIVACY_URL,
      termsOfService: process.env.CLIENT_TERMS_URL,
    },
    
    // Vendedor para handoff
    salesTeam: {
      name: process.env.SALES_TEAM_NAME || 'Equipe de Vendas',
      phone: process.env.SALES_TEAM_PHONE || '',
      email: process.env.SALES_TEAM_EMAIL,
    },
  };
}

// Exporta a configuração carregada
export const clientConfig = loadClientConfig();

/**
 * Helpers para usar a configuração
 */
export function getClientName(): string {
  return clientConfig.name;
}

export function getClientShortName(): string {
  return clientConfig.shortName;
}

export function getAssistantName(): string {
  return clientConfig.botConfig.assistantName;
}

export function getBusinessHours(): string {
  const { weekdays, saturday, sunday } = clientConfig.businessHours;
  let hours = weekdays;
  if (saturday) hours += ` | ${saturday}`;
  if (sunday) hours += ` | ${sunday}`;
  return hours;
}

export function getSalesTeamContact(): string {
  const { name, phone } = clientConfig.salesTeam;
  return phone ? `${name}: ${phone}` : name;
}
