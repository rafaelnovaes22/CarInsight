import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancingAgent } from '../../src/agents/financing.agent';
import { ConversationContext } from '../../src/types/conversation.types';
import {
  simulateFinancing,
  formatFinancingSimulation,
  extractMoneyValue,
} from '../../src/services/financing-simulator.service';
import { extractTradeInInfo } from '../../src/agents/vehicle-expert/extractors';

// Mock the services
vi.mock('../../src/services/financing-simulator.service', () => ({
  simulateFinancing: vi.fn(),
  formatFinancingSimulation: vi.fn(),
  extractMoneyValue: vi.fn(),
}));

vi.mock('../../src/agents/vehicle-expert/extractors', () => ({
  extractTradeInInfo: vi.fn(),
}));

describe('FinancingAgent', () => {
  let financingAgent: FinancingAgent;
  let mockContext: ConversationContext;

  beforeEach(() => {
    financingAgent = new FinancingAgent();
    vi.clearAllMocks();

    // Setup default mock behaviors for Financing Service
    vi.mocked(simulateFinancing).mockReturnValue({
      vehiclePrice: 90000,
      downPayment: 27000,
      tradeInValue: 0,
      totalEntry: 27000,
      financeAmount: 63000,
      interestRate: 0.015,
      installments: [
        {
          months: 48,
          monthlyPayment: 2000,
          totalPaid: 96000,
          totalInterest: 33000,
          totalInterestPaid: 33000,
        } as any,
      ],
      disclaimer: 'Simulação',
    });

    vi.mocked(formatFinancingSimulation).mockReturnValue(
      'Simulação de Financiamento:\n Entrada: R$ 27.000\n 48x R$ 2.000'
    );

    vi.mocked(extractMoneyValue).mockImplementation((text: string) => {
      if (text.includes('30')) return 30000;
      return null;
    });

    // Setup default mock behaviors for Extractors
    vi.mocked(extractTradeInInfo).mockReturnValue({
      // Default: no trade-in info
    });

    mockContext = {
      conversationId: 'test-conv',
      phoneNumber: '123456789',
      mode: 'financing',
      profile: {
        _lastShownVehicles: [
          {
            vehicleId: 'v1',
            brand: 'Honda',
            model: 'Civic',
            year: 2021,
            price: 90000,
          },
        ],
      },
      messages: [],
      metadata: {} as any,
    };
  });

  it('should extract down payment from user message', async () => {
    const result = await financingAgent.processReference('tenho 30 mil de entrada', mockContext);

    expect(result?.extractedPreferences.financingDownPayment).toBe(30000);
    expect(simulateFinancing).toHaveBeenCalled();
    expect(result?.response).toContain('Simulação');
  });

  it('should extract trade-in mention', async () => {
    // Setup mock for trade-in detection via extractor
    vi.mocked(extractTradeInInfo).mockReturnValue({
      model: 'Gol',
      year: 2020,
    });

    const result = await financingAgent.processReference('vou dar meu gol na troca', mockContext);

    expect(result?.extractedPreferences.hasTradeIn).toBe(true);
    // Note: The prompt might vary based on implementation, usually transfers to negotiation/sales
    expect(result?.response).toContain('Anotei');
  });

  it('should simulate financing when requested', async () => {
    await financingAgent.processReference('simula pra mim', mockContext);
    expect(simulateFinancing).toHaveBeenCalled();
  });

  it('should handle cash payment intent', async () => {
    const result = await financingAgent.processReference('quero pagar a vista', mockContext);
    expect(result?.extractedPreferences.wantsFinancing).toBe(false);
    expect(result?.response).toContain('à vista');
  });

  it('should return null if no vehicle shown', async () => {
    mockContext.profile._lastShownVehicles = [];
    const result = await financingAgent.processReference('quero financiar', mockContext);
    expect(result).toBeNull();
  });
});
