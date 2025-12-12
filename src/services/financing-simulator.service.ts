/**
 * Financing Simulator Service
 *
 * Calcula parcelas estimadas de financiamento usando taxas médias do mercado.
 * ATENÇÃO: Valores são ESTIMATIVAS para referência, não ofertas reais de banco.
 */

import { logger } from '../lib/logger';

/**
 * Taxas médias de juros para financiamento de veículos usados (ao mês)
 * Fonte: Média de mercado 2024
 */
const INTEREST_RATES = {
  // Taxas variam conforme perfil e entrada
  LOW: 0.0159, // 1.59% a.m. - Entrada >= 40%
  MEDIUM: 0.0189, // 1.89% a.m. - Entrada 20-40%
  HIGH: 0.0219, // 2.19% a.m. - Entrada < 20%
  ZERO_ENTRY: 0.0249, // 2.49% a.m. - Sem entrada
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
    installments,
    disclaimer:
      '⚠️ Valores estimados para referência. Condições reais dependem de análise de crédito.',
  };
}

/**
 * Formata simulação de financiamento para mensagem WhatsApp
 */
export function formatFinancingSimulation(
  simulation: FinancingSimulation,
  vehicleName: string
): string {
  const { vehiclePrice, totalEntry, financeAmount, installments, interestRate } = simulation;

  // Selecionar 3 opções mais comuns: 36, 48, 60 meses
  const options = installments.filter(i => [36, 48, 60].includes(i.months));

  let message = `📊 *Simulação de Financiamento*\n`;
  message += `🚗 ${vehicleName}\n\n`;
  message += `💰 Valor: R$ ${vehiclePrice.toLocaleString('pt-BR')}\n`;

  if (totalEntry > 0) {
    message += `💵 Entrada: R$ ${totalEntry.toLocaleString('pt-BR')}\n`;
  }

  message += `🏦 Financiar: R$ ${financeAmount.toLocaleString('pt-BR')}\n`;
  message += `📈 Taxa: ${(interestRate * 100).toFixed(2)}% a.m.\n\n`;

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
