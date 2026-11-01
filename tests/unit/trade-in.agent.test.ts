import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeInAgent } from '../../src/agents/trade-in.agent';
import { ConversationContext } from '../../src/types/conversation.types';
import * as Extractors from '../../src/agents/vehicle-expert/extractors';

// Mock extractors
vi.mock('../../src/agents/vehicle-expert/extractors', () => ({
  extractTradeInInfo: vi.fn(),
  inferBrandFromModel: vi.fn(),
}));

describe('TradeInAgent', () => {
  let tradeInAgent: TradeInAgent;
  let mockContext: ConversationContext;

  beforeEach(() => {
    tradeInAgent = new TradeInAgent();
    vi.clearAllMocks();

    // Default mock behaviors
    vi.mocked(Extractors.extractTradeInInfo).mockReturnValue({}); // No info by default
    vi.mocked(Extractors.inferBrandFromModel).mockReturnValue(undefined);

    mockContext = {
      conversationId: 'test-tradein',
      phoneNumber: '123456789',
      mode: 'trade_in',
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

  it('should detect trade-in intent without details', async () => {
    const result = await tradeInAgent.processTradeIn('quero dar meu carro na troca', mockContext);

    expect(result).not.toBeNull();
    expect(result?.extractedPreferences.hasTradeIn).toBe(true);
    expect(result?.extractedPreferences._awaitingTradeInDetails).toBe(true);
    expect(result?.response).toContain('Me conta sobre o seu veículo');
    expect(result?.nextMode).toBe('negotiation');
  });

  it('should extract trade-in details when provided', async () => {
    // Setup mock to simulate extraction success
    vi.mocked(Extractors.extractTradeInInfo).mockReturnValue({
      model: 'Onix',
      year: 2020,
      km: 50000,
      brand: 'Chevrolet',
    });

    const result = await tradeInAgent.processTradeIn('tenho um onix 2020', mockContext);

    expect(result).not.toBeNull();
    expect(result?.extractedPreferences.tradeInModel).toBe('onix');
    expect(result?.extractedPreferences.tradeInYear).toBe(2020);
    expect(result?.extractedPreferences._awaitingTradeInDetails).toBe(false);
    expect(result?.response).toContain('Onix 2020 pode entrar na negociação');
  });

  it('should infer brand if missing', async () => {
    vi.mocked(Extractors.extractTradeInInfo).mockReturnValue({
      model: 'Civic',
      year: 2018,
    });
    vi.mocked(Extractors.inferBrandFromModel).mockReturnValue('Honda');

    const result = await tradeInAgent.processTradeIn('tenho um civic 2018', mockContext);

    expect(result?.extractedPreferences.tradeInBrand).toBe('Honda');
    expect(result?.response).toContain('Honda');
  });

  it('should handle mixed financing and trade-in intent', async () => {
    // Mock extraction of trade-in details
    vi.mocked(Extractors.extractTradeInInfo).mockReturnValue({
      model: 'Fiesta',
      year: 2019,
    });

    const result = await tradeInAgent.processTradeIn(
      'quero financiar e dar meu fiesta 2019 na troca',
      mockContext
    );

    expect(result).not.toBeNull();
    expect(result?.extractedPreferences.hasTradeIn).toBe(true);
    expect(result?.extractedPreferences.tradeInModel).toBe('fiesta');

    // Should also detect financing intent and mention it
    expect(result?.extractedPreferences.wantsFinancing).toBe(true);
    expect(result?.response).toMatch(/financ|parcela|entrada/i);
  });

  it('should return null if no trade-in intent detected', async () => {
    const result = await tradeInAgent.processTradeIn('qual o preço?', mockContext);
    expect(result).toBeNull();
  });
});
