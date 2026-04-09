/**
 * Financing Simulator Service
 *
 * Calcula parcelas estimadas de financiamento usando taxas médias do mercado.
 * ATENÇÃO: Valores são ESTIMATIVAS para referência, não ofertas reais de banco.
 */

import { logger } from '../lib/logger';

/**
 * Referência oficial de mercado usada na simulação.
 * Fonte: Banco Central do Brasil, série SGS 25471
 * "Taxa média mensal de juros das operações de crédito com recursos livres -
 * Pessoas físicas - Aquisição de veículos"
 *
 * Último valor consultado para calibragem: fevereiro/2026 = 2,03% a.m.
 */
const MARKET_REFERENCE = {
  source: 'Banco Central do Brasil (SGS 25471)',
  referenceMonth: 'fevereiro/2026',
  averageMonthlyRate: 0.0203, // 2,03% a.m.
};

/**
 * Taxas de referência para estimativa por faixa de entrada.
 * Partem da média oficial de mercado e aplicam um ajuste heurístico simples
 * para refletir que perfil, entrada e risco alteram a taxa final.
 */
const INTEREST_RATES = {
  LOW: 0.0183, // 1,83% a.m. - perfil forte / entrada >= 40%
  MEDIUM: MARKET_REFERENCE.averageMonthlyRate, // 2,03% a.m. - faixa média de mercado
  HIGH: 0.0228, // 2,28% a.m. - entrada < 20% ou perfil mais arriscado
  ZERO_ENTRY: 0.0248, // 2,48% a.m. - sem entrada
};

/**
 * Prazos disponíveis para financiamento (em meses)
 */
const INSTALLMENT_OPTIONS = [12, 24, 36, 48, 60];

export interface FinancingSimulation {
  vehiclePrice: number;
  downPayment: number;
  tradeInValue: number;
  totalEntry: number; // entrada + troca
  financeAmount: number;
  interestRate: number;
  marketAverageRate: number;
  marketReferenceSource: string;
  marketReferenceMonth: string;
  installments: {
    months: number;
    monthlyPayment: number;
    totalPaid: number;
    totalInterest: number;
  }[];
  disclaimer: string;
}

/**
 * Calcula a taxa de juros baseada na porcentagem de entrada
 */
function getInterestRate(entryPercent: number): number {
  if (entryPercent >= 40) return INTEREST_RATES.LOW;
  if (entryPercent >= 20) return INTEREST_RATES.MEDIUM;
  if (entryPercent > 0) return INTEREST_RATES.HIGH;
  return INTEREST_RATES.ZERO_ENTRY;
}

/**
 * Calcula parcela usando Sistema Price (parcelas fixas)
 * PMT = PV * [i * (1+i)^n] / [(1+i)^n - 1]
 */
function calculateMonthlyPayment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0) return 0;
  if (monthlyRate === 0) return principal / months;

  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/**
 * Simula financiamento de veículo
 */
export function simulateFinancing(
  vehiclePrice: number,
  downPayment: number = 0,
  tradeInValue: number = 0
): FinancingSimulation {
  const totalEntry = downPayment + tradeInValue;
  const financeAmount = Math.max(0, vehiclePrice - totalEntry);
  const entryPercent = (totalEntry / vehiclePrice) * 100;
  const interestRate = getInterestRate(entryPercent);

  logger.info(
    {
      vehiclePrice,
      downPayment,
      tradeInValue,
      totalEntry,
      financeAmount,
      entryPercent: entryPercent.toFixed(1),
      interestRate: (interestRate * 100).toFixed(2),
    },
    'Financing simulation'
  );

  const installments = INSTALLMENT_OPTIONS.map(months => {
    const monthlyPayment = calculateMonthlyPayment(financeAmount, interestRate, months);
    const totalPaid = monthlyPayment * months;
    const totalInterest = totalPaid - financeAmount;

    return {
      months,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
    };
  });

  return {
    vehiclePrice,
    downPayment,
    tradeInValue,
    totalEntry,
    financeAmount,
    interestRate,
    marketAverageRate: MARKET_REFERENCE.averageMonthlyRate,
    marketReferenceSource: MARKET_REFERENCE.source,
    marketReferenceMonth: MARKET_REFERENCE.referenceMonth,
    installments,
    disclaimer: `⚠️ Simulação com taxa de referência inspirada na média de mercado do ${MARKET_REFERENCE.source} (${MARKET_REFERENCE.referenceMonth}: ${(MARKET_REFERENCE.averageMonthlyRate * 100).toFixed(2)}% a.m.). A taxa efetiva pode variar conforme entrada, prazo, score e análise de crédito.`,
  };
}

/**
 * Formata simulação de financiamento para mensagem WhatsApp
 */
export function formatFinancingSimulation(
  simulation: FinancingSimulation,
  vehicleName: string
): string {
  const {
    vehiclePrice,
    totalEntry,
    financeAmount,
    installments,
    interestRate,
    marketAverageRate,
    marketReferenceMonth,
  } = simulation;

  // Selecionar 3 opções mais comuns: 36, 48, 60 meses
  const options = installments.filter(i => [36, 48, 60].includes(i.months));

  let message = `📊 *Simulação de Financiamento*\n`;
  message += `🚗 ${vehicleName}\n\n`;
  message += `💰 Valor: R$ ${vehiclePrice.toLocaleString('pt-BR')}\n`;

  if (totalEntry > 0) {
    message += `💵 Entrada: R$ ${totalEntry.toLocaleString('pt-BR')}\n`;
  }

  message += `🏦 Financiar: R$ ${financeAmount.toLocaleString('pt-BR')}\n`;
  message += `📈 Taxa de referência nesta simulação: ${(interestRate * 100).toFixed(2)}% a.m.\n`;
  message += `ℹ️ Média de mercado Bacen (${marketReferenceMonth}): ${(marketAverageRate * 100).toFixed(2)}% a.m.\n\n`;

  message += `*Parcelas estimadas:*\n`;
  options.forEach(opt => {
    message += `• ${opt.months}x de R$ ${opt.monthlyPayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  });

  message += `\n${simulation.disclaimer}`;

  return message;
}

/**
 * Extrai valor monetário de uma string
 * Exemplos: "10 mil", "15000", "R$ 20.000", "5k"
 */
export function extractMoneyValue(text: string): number | null {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

  // Padrão: "10 mil", "10mil", "10k"
  const milMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(mil|k)/i);
  if (milMatch) {
    const value = parseFloat(milMatch[1].replace(',', '.'));
    return value * 1000;
  }

  // Padrão: "R$ 15.000" ou "15000" ou "15.000"
  // IMPORTANTE: A primeira alternativa usa + (não *) para exigir pelo menos um separador de milhar
  // Isso evita que "10000" seja parseado como "100" (pegando apenas os primeiros 3 dígitos)
  // - Com separador: \d{1,3}(?:[.,]\d{3})+ captura "10.000", "100.000", etc.
  // - Sem separador: \d+ captura "10000", "15000", etc.
  const valueMatch = normalized.match(/r?\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+)/);
  if (valueMatch) {
    // Remove pontos de milhar e converte vírgula para ponto
    const value = valueMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}
