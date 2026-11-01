import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageHandlerLeadService } from '../../../src/services/message-handler-v2/lead.service';
import type { ConversationState } from '../../../src/types/state.types';

const { sendMessage, leadCreate } = vi.hoisted(() => ({
  sendMessage: vi.fn().mockResolvedValue(undefined),
  leadCreate: vi.fn().mockResolvedValue({ id: 'lead-1' }),
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    lead: {
      create: leadCreate,
    },
  },
}));

vi.mock('../../../src/services/whatsapp-factory', () => ({
  WhatsAppServiceFactory: {
    getInstance: () => ({
      sendMessage,
    }),
  },
}));

describe('MessageHandlerLeadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SALES_PHONE_NUMBER = '5511888888888';
  });

  it('prefers the selected vehicle snapshot and also includes the latest shown options', async () => {
    const service = new MessageHandlerLeadService();
    const conversation = {
      id: 'conv-1',
      customerName: 'Rafael',
      phoneNumber: '5511949105033',
    };

    const state: ConversationState = {
      conversationId: 'conv-1',
      phoneNumber: '5511949105033',
      messages: [],
      quiz: { currentQuestion: 1, progress: 0, answers: { budget: 150000 }, isComplete: false },
      profile: {
        customerName: 'Rafael',
        budget: 150000,
        wantsFinancing: true,
        financingDownPayment: 20000,
        _selectedVehicleId: 'captur-1',
        _selectedVehicleSnapshot: {
          vehicleId: 'captur-1',
          brand: 'RENAULT',
          model: 'CAPTUR',
          year: 2019,
          price: 76990,
        },
        _lastShownVehicles: [
          { vehicleId: 'kicks-1', brand: 'NISSAN', model: 'KICKS', year: 2024, price: 118990 },
          {
            vehicleId: 'corolla-cross-1',
            brand: 'TOYOTA',
            model: 'COROLLA CROSS',
            year: 2022,
            price: 149990,
          },
        ],
      },
      recommendations: [],
      graph: { currentNode: 'negotiation', nodeHistory: [], errorCount: 0, loopCount: 0 },
      metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: ['handoff_requested'] },
    };

    await service.createLead(conversation, state, conversation.phoneNumber);

    expect(leadCreate).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(1);

    const [, message] = sendMessage.mock.calls[0];
    expect(message).toContain('Interesse principal');
    expect(message).toContain('RENAULT CAPTUR 2019');
    expect(message).toContain('Ultimas opcoes apresentadas');
    expect(message).toContain('NISSAN KICKS 2024');
    expect(message).toContain('TOYOTA COROLLA CROSS 2022');
  });
});
