/**
 * Healthcare Domain Configuration
 *
 * System prompts, specialty definitions, and disclosure messages.
 */

// ── System Prompts ──

export const healthcarePrompts: Record<string, string> = {
  main: 'Voce e um assistente virtual de agendamento de consultas medicas. Seja empático, profissional e objetivo. Nunca faca diagnosticos — apenas ajude a direcionar o paciente para a especialidade correta.',

  greeting:
    'Cumprimente o paciente de forma calorosa. Pergunte o nome dele e como pode ajudar (agendar consulta, tirar duvida, ou emergencia). Seja breve e acolhedor.',

  triage:
    'Colete informacoes sobre os sintomas ou necessidade do paciente. Com base nas palavras-chave, sugira uma especialidade medica. NAO faca diagnosticos. Pergunte se o paciente tem convenio.',

  scheduling:
    'Apresente os horarios disponiveis para a especialidade escolhida. Deixe o paciente escolher o melhor horario. Seja claro sobre data, hora e local.',

  confirmation:
    'Resuma o agendamento: medico, especialidade, data, hora e local. Peca confirmacao ao paciente. Se ele quiser reagendar, volte para a etapa de agendamento.',
};

// ── Recognized Specialties ──

export const SPECIALTIES = [
  'clinico_geral',
  'cardiologia',
  'dermatologia',
  'ginecologia',
  'neurologia',
  'oftalmologia',
  'ortopedia',
  'pediatria',
  'psiquiatria',
  'urologia',
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  clinico_geral: 'Clinico Geral',
  cardiologia: 'Cardiologia',
  dermatologia: 'Dermatologia',
  ginecologia: 'Ginecologia',
  neurologia: 'Neurologia',
  oftalmologia: 'Oftalmologia',
  ortopedia: 'Ortopedia',
  pediatria: 'Pediatria',
  psiquiatria: 'Psiquiatria',
  urologia: 'Urologia',
};

// ── Symptom → Specialty Mapping (keyword-based triage) ──

export const SYMPTOM_SPECIALTY_MAP: Record<string, Specialty> = {
  // Clinico Geral
  febre: 'clinico_geral',
  gripe: 'clinico_geral',
  resfriado: 'clinico_geral',
  'check-up': 'clinico_geral',
  checkup: 'clinico_geral',
  'exame de rotina': 'clinico_geral',
  cansaco: 'clinico_geral',
  mal_estar: 'clinico_geral',

  // Cardiologia
  coracao: 'cardiologia',
  palpitacao: 'cardiologia',
  pressao_alta: 'cardiologia',
  'dor no peito': 'cardiologia',
  hipertensao: 'cardiologia',

  // Dermatologia
  pele: 'dermatologia',
  acne: 'dermatologia',
  mancha: 'dermatologia',
  alergia_pele: 'dermatologia',
  coceira: 'dermatologia',

  // Neurologia
  cabeca: 'neurologia',
  enxaqueca: 'neurologia',
  tontura: 'neurologia',
  formigamento: 'neurologia',

  // Ortopedia
  osso: 'ortopedia',
  fratura: 'ortopedia',
  coluna: 'ortopedia',
  joelho: 'ortopedia',
  'dor nas costas': 'ortopedia',

  // Oftalmologia
  vista: 'oftalmologia',
  olho: 'oftalmologia',
  visao: 'oftalmologia',
  oculos: 'oftalmologia',

  // Ginecologia
  menstruacao: 'ginecologia',
  gravidez: 'ginecologia',
  preventivo: 'ginecologia',

  // Pediatria
  filho: 'pediatria',
  crianca: 'pediatria',
  bebe: 'pediatria',

  // Psiquiatria
  ansiedade: 'psiquiatria',
  depressao: 'psiquiatria',
  insonia: 'psiquiatria',
  estresse: 'psiquiatria',

  // Urologia
  urina: 'urologia',
  prostata: 'urologia',
  rim: 'urologia',
};

// ── Disclosure Messages ──

export const healthcareDisclosure = {
  greeting:
    '*Importante:* Sou uma inteligencia artificial e NAO realizo diagnosticos medicos. Posso ajudar a agendar consultas e direcionar voce para a especialidade correta. Em caso de emergencia, ligue 192 (SAMU).',
  handoff: 'Vou transferir voce para nossa equipe de atendimento para mais informacoes.',
  aiDisclaimer:
    '_Sou um assistente virtual de agendamento. Para orientacoes medicas, consulte um profissional de saude._',
};
