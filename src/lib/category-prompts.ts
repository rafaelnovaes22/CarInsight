/**
 * Prompts especializados para classificação de veículos por categoria
 *
 * Cada prompt é focado em uma única categoria para maximizar precisão
 * e eliminar "task interference" que ocorre com prompts monolíticos.
 *
 * @see implementation_plan.md para detalhes da arquitetura
 */

export interface VehicleData {
  marca: string;
  modelo: string;
  ano: number;
  carroceria: string;
  portas: number;
  arCondicionado: boolean;
  cor?: string | null;
  combustivel?: string | null;
  km?: number | null;
  cambio?: string | null;
}

export interface CategoryResult {
  approved: boolean;
  confidence: 'alta' | 'media' | 'baixa';
  reasoning: string;
}

export interface FamiliaResult extends CategoryResult {
  aptoFamilia: boolean;
}

export interface UberXResult extends CategoryResult {
  aptoUber: boolean;
  uberTier: 'X' | 'Comfort' | null;
}

export interface UberBlackResult extends CategoryResult {
  aptoUberBlack: boolean;
}

export interface CargaResult extends CategoryResult {
  aptoCarga: boolean;
  tipoUtilidade: 'pickup' | 'van' | 'furgao' | null;
}

export interface UsoDiarioResult extends CategoryResult {
  aptoUsoDiario: boolean;
  economiaEstimada: 'alta' | 'media' | 'baixa';
}

export interface EntregaResult extends CategoryResult {
  aptoEntrega: boolean;
  capacidadeCarga: 'alta' | 'media' | 'baixa';
}

export interface ViagemResult extends CategoryResult {
  aptoViagem: boolean;
  confortoEstrada: 'alto' | 'medio' | 'baixo';
}

// ============================================================================
// PROMPT: FAMÍLIA
// ============================================================================
export const PROMPT_FAMILIA = `# Avaliador: Carro para FAMÍLIA

Você é um especialista em carros para famílias brasileiras. Avalie SE este veículo é adequado para uma família com crianças pequenas (cadeirinhas, bebê conforto).

## CRITÉRIOS OBRIGATÓRIOS (todos devem ser atendidos):
✅ Mínimo 4 portas
✅ Espaço traseiro suficiente para 2 cadeirinhas infantis lado a lado
✅ Carroceria que permita acesso fácil ao banco traseiro

## CARROCERIAS APROVADAS (espaço traseiro adequado):
- SUVs e CROSSOVERS (qualquer porte - compactos, médios ou grandes)
- Sedans MÉDIOS ou GRANDES (entre-eixos >= 2.55m tipicamente)
- Minivans e Peruas
- Station Wagons

## CARROCERIAS REPROVADAS (espaço traseiro insuficiente):
- ❌ HATCHES (mesmo com 4 portas - banco traseiro estreito)
- ❌ SEDANS COMPACTOS (derivados de hatch - ex: versões sedan de hatches pequenos)
- ❌ PICKUPS CABINE SIMPLES
- ❌ Carros 2 portas
- ❌ Motos

## REGRA DE OURO:
Se a carroceria for SUV, Crossover, Minivan ou Perua com 4+ portas = APROVAR.
Se for Hatch ou Sedan compacto = REPROVAR.

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Portas: {portas}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoFamilia": true/false, "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// PROMPT: UBER X/COMFORT
// ============================================================================
export const PROMPT_UBER_X = `# Avaliador: Elegibilidade UBER X/COMFORT

Você é um especialista em veículos elegíveis para Uber X e Comfort em São Paulo.

## REGRAS DA UBER (São Paulo 2024):
✅ Ano mínimo: 2012 (X) / 2015 (Comfort)
✅ 4 portas obrigatórias
✅ Ar-condicionado funcional obrigatório
✅ Cores neutras preferidas (preto, branco, prata, cinza)
✅ Modelo na whitelist oficial

## MODELOS ACEITOS (whitelist):
- Honda: Civic, City, Fit
- Toyota: Corolla, Etios, Yaris
- Chevrolet: Onix, Prisma, Cruze, Cobalt
- Volkswagen: Gol, Voyage, Polo, Virtus, Jetta
- Fiat: Argo, Cronos, Siena, Grand Siena
- Hyundai: HB20, HB20S, Elantra
- Nissan: March, Versa, Sentra
- Renault: Logan, Sandero, Kwid
- Peugeot: 208, 2008
- Citroën: C3, C4

IMPORTANTE: HB20S (sedan) É elegível para UberX!

## NUNCA ACEITOS:
- ❌ Pickups (Strada, Saveiro, S10, Hilux)
- ❌ Vans e Furgões
- ❌ Minivans (Spin, Zafira) - exceto caso específico
- ❌ Ano < 2012
- ❌ Sem ar-condicionado
- ❌ 2/3 portas

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Portas: {portas}
- Ar-Condicionado: {arCondicionado}
- Cor: {cor}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoUber": true/false, "uberTier": "X"|"Comfort"|null, "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// PROMPT: UBER BLACK
// ============================================================================
export const PROMPT_UBER_BLACK = `# Avaliador: Elegibilidade UBER BLACK

Você é um especialista em veículos elegíveis para Uber Black em São Paulo.

## REGRAS UBER BLACK (São Paulo 2024):
✅ Ano mínimo: 2018 (Sedans) / 2019 (SUVs)
✅ Categoria PREMIUM obrigatória
✅ Ar-condicionado funcional
✅ Acabamento interno de qualidade (couro ou similar)
✅ Cores: APENAS preto, branco, ou prata escuro

## MODELOS ACEITOS - SEDANS PREMIUM:
- Toyota Corolla (2018+)
- Honda Civic (2018+)
- Chevrolet Cruze (2018+)
- VW Jetta (2018+)
- Nissan Sentra (2018+)
- Kia Cerato (2018+)

## MODELOS ACEITOS - SUVs PREMIUM (2019+):
- Jeep: Compass, Renegade, Commander
- Hyundai: Creta, Tucson
- Honda: HR-V
- Toyota: Corolla Cross, SW4
- VW: T-Cross, Tiguan, Taos
- Chevrolet: Tracker, Equinox

## EXPLICITAMENTE EXCLUÍDOS (NÃO são premium):
- ❌ HB20/HB20S (NÃO é premium - entrada da Hyundai)
- ❌ Onix/Onix Plus (NÃO é premium - entrada da Chevrolet)
- ❌ Argo/Cronos (NÃO é premium - entrada da Fiat)
- ❌ Gol/Voyage/Polo (NÃO é premium - entrada da VW)
- ❌ Pickups
- ❌ Minivans
- ❌ Cores diferentes de preto/branco/prata

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Portas: {portas}
- Ar-Condicionado: {arCondicionado}
- Cor: {cor}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoUberBlack": true/false, "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// PROMPT: CARGA
// ============================================================================
export const PROMPT_CARGA = `# Avaliador: Carro para TRABALHO/CARGA

Você é um especialista em veículos para trabalho pesado e transporte de carga no Brasil.

## O QUE É "APTO CARGA":
Veículo usado COMO FERRAMENTA de trabalho para transportar:
- Materiais de construção
- Ferramentas/equipamentos
- Mercadorias em volume
- Entregas comerciais pesadas

## CRITÉRIOS OBRIGATÓRIOS:
✅ Capacidade de carga significativa (caçamba, área de carga, porta-malas grande aberto)
✅ Carroceria utilitária

## TIPOS APROVADOS:
- ✅ PICKUPS: Strada, Saveiro, Montana, S10, Hilux, Ranger, Amarok, Frontier
- ✅ VANS DE CARGA: Fiorino, Kangoo, Dobló Cargo, Partner, Berlingo
- ✅ FURGÕES: Ducato, Sprinter, Daily, Accelo
- ✅ VUCs: Veículos Urbanos de Carga

## TIPOS REPROVADOS:
- ❌ Carros de passeio (Sedan, Hatch, SUV)
- ❌ Minivans de passageiros (Spin, Zafira)
- ❌ Motos

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoCarga": true/false, "tipoUtilidade": "pickup"|"van"|"furgao"|null, "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// PROMPT: USO DIÁRIO
// ============================================================================
export const PROMPT_USO_DIARIO = `# Avaliador: Carro para USO DIÁRIO / COMMUTE

Você é um especialista em carros para uso diário (ir ao trabalho, escola, compras).

## O QUE É "USO DIÁRIO":
Veículo para DESLOCAMENTO pessoal do dia a dia, NÃO para trabalhar COM o carro.
- Ir ao trabalho
- Levar filhos à escola
- Fazer compras
- Lazer urbano

## CRITÉRIOS OBRIGATÓRIOS:
✅ Ar-condicionado (essencial no Brasil)
✅ Ano >= 2010 (conforto mínimo)
✅ Economia razoável (evitar diesel pesado)
✅ Conforto para uso urbano

## TIPOS APROVADOS:
- ✅ HATCHES: Onix, HB20, Argo, Polo, Gol, Fox, Ka, Sandero
- ✅ SEDANS: Corolla, Civic, HB20S, Onix Plus, Cronos
- ✅ SUVs COMPACTOS: Creta, Tracker, HR-V, T-Cross
- ✅ MINIVANS: Spin

## TIPOS REPROVADOS (não econômicos ou não urbanos):
- ❌ Pickups GRANDES diesel (S10, Hilux, Ranger) - consumo alto, difícil estacionar
- ❌ Veículos sem ar-condicionado
- ❌ Ano < 2010
- ❌ Furgões comerciais
- ❌ Motos

**Nota**: Uma Strada cabine estendida com ar PODE ser apta uso diário!

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Ar-Condicionado: {arCondicionado}
- Combustível: {combustivel}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoUsoDiario": true/false, "economiaEstimada": "alta"|"media"|"baixa", "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// PROMPT: ENTREGA
// ============================================================================
export const PROMPT_ENTREGA = `# Avaliador: Carro para APPS DE ENTREGA

Você é um especialista em veículos para trabalhar em apps de entrega (Mercado Livre Entregas, Lalamove, Uber Flash, 99Entrega, Shopee Entregas).

## REGRAS DOS APPS DE ENTREGA:
✅ Ano mínimo: geralmente 2010-2012
✅ Porta-malas acessível / área de carga
✅ Mínimo 4 portas (para entregas maiores)
✅ Documentação em dia (não avaliamos isso)

## TIPOS APROVADOS:
- ✅ HATCHES com porta-malas ok: Onix, HB20, Argo, Polo
- ✅ SEDANS: Cronos, HB20S, Onix Plus, Corolla
- ✅ SUVs: Creta, Tracker, HR-V (porta-malas grande)
- ✅ PICKUPS cabine dupla: Strada, Saveiro (versões cabine estendida/dupla)
- ✅ VANS: Fiorino, Kangoo (excelentes para entrega)
- ✅ MINIVANS: Spin, Zafira

## TIPOS REPROVADOS:
- ❌ Ano < 2010
- ❌ Pickups cabine SIMPLES (pouco prático para carga fechada)
- ❌ Conversíveis / Esportivos (2 lugares)
- ❌ Motos (apps separados)

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Portas: {portas}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoEntrega": true/false, "capacidadeCarga": "alta"|"media"|"baixa", "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// PROMPT: VIAGEM
// ============================================================================
export const PROMPT_VIAGEM = `# Avaliador: Carro para VIAGEM LONGA

Você é um especialista em carros adequados para viagens de estrada no Brasil.

## O QUE É "APTO VIAGEM":
Veículo confortável e seguro para viagens longas (200km+):
- Viagem de férias
- Visita a parentes em outras cidades
- Road trips

## CRITÉRIOS OBRIGATÓRIOS:
✅ Ar-condicionado (essencial)
✅ 4+ portas (conforto ocupantes)
✅ Espaço para bagagem
✅ Estabilidade em velocidade de estrada

## CARROCERIAS APROVADAS (conforto e estabilidade):
- SUVs e CROSSOVERS (qualquer porte - compactos, médios ou grandes)
- Sedans MÉDIOS ou GRANDES
- Minivans e Peruas
- Pickups CABINE DUPLA (espaço para passageiros)

## CARROCERIAS REPROVADAS:
- ❌ HATCHES PEQUENOS/SUBCOMPACTOS (instáveis em velocidade alta)
- ❌ PICKUPS CABINE SIMPLES (desconfortáveis para passageiros)
- ❌ Veículos sem ar-condicionado
- ❌ Veículos muito antigos (< 2008)
- ❌ Motos

## REGRA DE OURO:
Se for SUV, Crossover, Sedan médio/grande, Minivan ou Perua com AR = APROVAR.
Se for Hatch pequeno ou Pickup cabine simples = REPROVAR.

## VEÍCULO PARA ANÁLISE:
- Marca: {marca}
- Modelo: {modelo}
- Ano: {ano}
- Carroceria: {carroceria}
- Portas: {portas}
- Ar-Condicionado: {arCondicionado}

## RESPOSTA (apenas JSON, sem markdown):
{"aptoViagem": true/false, "confortoEstrada": "alto"|"medio"|"baixo", "confidence": "alta"|"media"|"baixa", "reasoning": "Explicação em 1 linha"}`;

// ============================================================================
// UTILITY: Interpolate vehicle data into prompt
// ============================================================================
export function interpolatePrompt(template: string, vehicle: VehicleData): string {
  return template
    .replace('{marca}', vehicle.marca)
    .replace('{modelo}', vehicle.modelo)
    .replace('{ano}', vehicle.ano.toString())
    .replace('{carroceria}', vehicle.carroceria)
    .replace('{portas}', vehicle.portas.toString())
    .replace('{arCondicionado}', vehicle.arCondicionado ? 'Sim' : 'Não')
    .replace('{cor}', vehicle.cor ?? 'Não informada')
    .replace('{combustivel}', vehicle.combustivel ?? 'Não informado')
    .replace('{km}', vehicle.km?.toLocaleString('pt-BR') ?? 'Não informado')
    .replace('{cambio}', vehicle.cambio ?? 'Não informado');
}

// ============================================================================
// CATEGORY REGISTRY
// ============================================================================
export const CATEGORY_PROMPTS = {
  familia: {
    template: PROMPT_FAMILIA,
    fieldName: 'aptoFamilia' as const,
  },
  uberX: {
    template: PROMPT_UBER_X,
    fieldName: 'aptoUber' as const,
  },
  uberBlack: {
    template: PROMPT_UBER_BLACK,
    fieldName: 'aptoUberBlack' as const,
  },
  carga: {
    template: PROMPT_CARGA,
    fieldName: 'aptoCarga' as const,
  },
  usoDiario: {
    template: PROMPT_USO_DIARIO,
    fieldName: 'aptoUsoDiario' as const,
  },
  entrega: {
    template: PROMPT_ENTREGA,
    fieldName: 'aptoEntrega' as const,
  },
  viagem: {
    template: PROMPT_VIAGEM,
    fieldName: 'aptoViagem' as const,
  },
} as const;

export type CategoryName = keyof typeof CATEGORY_PROMPTS;
