import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryClassifierService } from '../../src/services/category-classifier.service';
import { VehicleData } from '../../src/lib/category-prompts';
import * as llmRouter from '../../src/lib/llm-router';

// Mock the LLM router
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(),
}));

// Mock the Uber eligibility agent (uses RAG)
vi.mock('../../src/services/uber-eligibility-agent.service', () => ({
  uberEligibilityAgent: {
    evaluate: vi.fn().mockResolvedValue({
      uberX: true,
      uberComfort: false,
      uberBlack: false,
      reasoning: 'Mock: veículo elegível para UberX',
      confidence: 0.9,
      source: {
        citySlug: 'sao-paulo',
        sourceUrl: 'https://uber.com/mock',
        fetchedAt: new Date().toISOString(),
      },
    }),
  },
}));

describe('CategoryClassifierService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockVehicle = (overrides: Partial<VehicleData> = {}): VehicleData => ({
    marca: 'Hyundai',
    modelo: 'Creta',
    ano: 2021,
    carroceria: 'SUV',
    portas: 5,
    arCondicionado: true,
    cor: 'Preto',
    combustivel: 'Flex',
    km: 30000,
    cambio: 'Automático',
    ...overrides,
  });

  describe('classifyAll', () => {
    it('should use RAG for Uber and LLM for other categories', async () => {
      // Mock LLM responses for non-Uber categories
      vi.mocked(llmRouter.chatCompletion).mockImplementation(async messages => {
        const prompt = messages[0].content;
        if (prompt.includes('FAMÍLIA')) {
          return JSON.stringify({
            aptoFamilia: true,
            confidence: 'alta',
            reasoning: 'SUV com espaço para família',
          });
        }
        if (prompt.includes('CARGA')) {
          return JSON.stringify({
            aptoCarga: false,
            tipoUtilidade: null,
            confidence: 'alta',
            reasoning: 'SUV não é utilitário',
          });
        }
        if (prompt.includes('USO DIÁRIO')) {
          return JSON.stringify({
            aptoUsoDiario: true,
            economiaEstimada: 'media',
            confidence: 'alta',
            reasoning: 'SUV com AR adequado para commute',
          });
        }
        if (prompt.includes('ENTREGA')) {
          return JSON.stringify({
            aptoEntrega: true,
            capacidadeCarga: 'media',
            confidence: 'alta',
            reasoning: 'Porta-malas bom para entregas',
          });
        }
        if (prompt.includes('VIAGEM')) {
          return JSON.stringify({
            aptoViagem: true,
            confortoEstrada: 'alto',
            confidence: 'alta',
            reasoning: 'SUV confortável para estrada',
          });
        }
        return '{}';
      });

      const vehicle = createMockVehicle();
      const result = await CategoryClassifierService.classifyAll(vehicle);

      // Uber results come from mock RAG
      expect(result.aptoUber).toBe(true); // From mocked UberEligibilityAgent
      expect(result.aptoUberBlack).toBe(false); // From mocked UberEligibilityAgent

      // Other results come from LLM
      expect(result.aptoFamilia).toBe(true);
      expect(result.aptoCarga).toBe(false);
      expect(result.aptoUsoDiario).toBe(true);
      expect(result.aptoEntrega).toBe(true);
      expect(result.aptoViagem).toBe(true);

      // LLM should be called 5 times (non-Uber categories only)
      expect(llmRouter.chatCompletion).toHaveBeenCalledTimes(5);
    });

    it('should fallback to deterministic rules on LLM failure', async () => {
      // Mock LLM to always fail
      vi.mocked(llmRouter.chatCompletion).mockRejectedValue(new Error('LLM unavailable'));

      const vehicle = createMockVehicle({
        carroceria: 'SUV',
        portas: 5,
        arCondicionado: true,
      });

      const result = await CategoryClassifierService.classifyAll(vehicle);

      // Should still get results via fallback
      expect(result.aptoFamilia).toBe(true); // SUV with 5 doors = family
      expect(result.aptoCarga).toBe(false); // SUV is not cargo
      expect(result.llmUsed).toBe(false); // LLM was not used
    });

    it('should mark hatch as NOT family-suitable', async () => {
      vi.mocked(llmRouter.chatCompletion).mockImplementation(async messages => {
        const prompt = messages[0].content;
        if (prompt.includes('FAMÍLIA')) {
          return JSON.stringify({
            aptoFamilia: false,
            confidence: 'alta',
            reasoning: 'Hatch não cabe 2 cadeirinhas',
          });
        }
        return JSON.stringify({ approved: false, confidence: 'alta', reasoning: 'N/A' });
      });

      const vehicle = createMockVehicle({
        modelo: 'HB20',
        carroceria: 'Hatch',
        portas: 5,
      });

      const result = await CategoryClassifierService.classifyAll(vehicle);

      expect(result.aptoFamilia).toBe(false);
    });

    it('should mark pickup as cargo-suitable', async () => {
      vi.mocked(llmRouter.chatCompletion).mockImplementation(async messages => {
        const prompt = messages[0].content;
        if (prompt.includes('CARGA')) {
          return JSON.stringify({
            aptoCarga: true,
            tipoUtilidade: 'pickup',
            confidence: 'alta',
            reasoning: 'Pickup para carga',
          });
        }
        return JSON.stringify({ approved: false, confidence: 'alta', reasoning: 'N/A' });
      });

      const vehicle = createMockVehicle({
        marca: 'Fiat',
        modelo: 'Strada',
        carroceria: 'Pickup',
        portas: 2,
      });

      const result = await CategoryClassifierService.classifyAll(vehicle);

      expect(result.aptoCarga).toBe(true);
    });
  });

  describe('classifyCategory', () => {
    it('should classify single category only', async () => {
      vi.mocked(llmRouter.chatCompletion).mockResolvedValue(
        JSON.stringify({
          aptoFamilia: true,
          confidence: 'alta',
          reasoning: 'SUV espaçoso',
        })
      );

      const vehicle = createMockVehicle();
      const result = await CategoryClassifierService.classifyCategory('familia', vehicle);

      expect(result.category).toBe('familia');
      expect(result.approved).toBe(true);
      expect(result.confidence).toBe('alta');
      expect(result.llmSuccess).toBe(true);

      // Should call LLM only once
      expect(llmRouter.chatCompletion).toHaveBeenCalledTimes(1);
    });
  });
});
