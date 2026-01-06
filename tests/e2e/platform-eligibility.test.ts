import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { platformValidator } from '../../src/services/platform-validator.service';
import * as llmRouter from '../../src/lib/llm-router';
import { PlatformRulesConfig } from '../../src/config/platform-rules.config';

/**
 * E2E / Integration Test for Eligibility System
 *
 * Focus: logic flow, prompt generation accuracy, and response parsing.
 * We mock the actual LLM network call to ensure determinism and speed,
 * but validates that the PROMPT sent to the LLM contains the correct dynamic rules.
 */
describe('E2E: Platform Eligibility System', () => {
  let chatSpy: any;

  beforeEach(() => {
    // Spy on the LLM router to inspect the prompt being generated
    chatSpy = vi.spyOn(llmRouter, 'chatCompletion');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const currentYear = new Date().getFullYear();

  it('Scenario 1: Uber Black Candidate (Corolla 2024)', async () => {
    // 1. Setup Mock Response (Simulating what a "good" LLM would return for a Corolla)
    chatSpy.mockResolvedValue(
      JSON.stringify({
        transport: {
          uberX: true,
          uberComfort: true,
          uberBlack: true,
          pop99: true,
          comfort99: true,
          indrive: true,
        },
        delivery: { ifoodMoto: false, loggiMoto: false, mercadoEnviosFlex: true, shopee: true },
        reasoning: 'Corolla 2024 é um sedan médio premium, elegível para Black.',
        confidence: 1.0,
      })
    );

    const vehicle = {
      marca: 'Toyota',
      modelo: 'Corolla Altis',
      ano: 2024,
      carroceria: 'Sedan',
      arCondicionado: true,
      portas: 4,
      cambio: 'Automatico',
    };

    // 2. Execute
    const result = await platformValidator.validateAll(vehicle);

    // 3. Validate Prompt Content (CRITICAL: Did we send the right rules?)
    const calledPrompt = chatSpy.mock.calls[0][0][0].content;

    // Check if dynamic rules are present
    const expectedBlackRule = `Idade Max: ${PlatformRulesConfig.transport.uber.black.minYearRelative} anos`;
    expect(calledPrompt).toContain(expectedBlackRule);
    expect(calledPrompt).toContain(`DATA REF: ${currentYear}`);

    // Check if exclusions lists are present
    expect(calledPrompt).toContain('HB20');
    expect(calledPrompt).toContain('Onix');

    // 4. Validate Result Parsing
    expect(result.transport.uberBlack).toBe(true);
    expect(result.transport.uberX).toBe(true);
    expect(result.delivery.mercadoEnviosFlex).toBe(true); // Yes, you can deliver packages with a Corolla
  });

  it('Scenario 2: Popular Hatch (Onix 2019) - Should Fail Black', async () => {
    // Onix is explicitly in the exclusion list for Black
    chatSpy.mockResolvedValue(
      JSON.stringify({
        transport: {
          uberX: true,
          uberComfort: true,
          uberBlack: false,
          pop99: true,
          comfort99: true,
        },
        delivery: { mercadoEnviosFlex: true, shopee: true },
        reasoning: 'Onix está na lista de exclusão do Black.',
        confidence: 1.0,
      })
    );

    const vehicle = {
      marca: 'Chevrolet',
      modelo: 'Onix Plus',
      ano: 2019,
      carroceria: 'Sedan',
      arCondicionado: true,
      portas: 4,
      cambio: 'Automatico',
    };

    const result = await platformValidator.validateAll(vehicle);

    // Validate Logic
    expect(result.transport.uberBlack).toBe(false); // MUST be false
    expect(result.transport.uberX).toBe(true);
    expect(result.transport.uberComfort).toBe(true); // 2019 is usually fine for Comfort
  });

  it('Scenario 3: Delivery Moto (Honda CG 160 2018)', async () => {
    chatSpy.mockResolvedValue(
      JSON.stringify({
        transport: { uberX: false },
        delivery: { ifoodMoto: true, loggiMoto: true, lalamoveMoto: true },
        reasoning: 'Moto aceita para entregas.',
        confidence: 0.95,
      })
    );

    const vehicle = {
      marca: 'Honda',
      modelo: 'CG 160 Fan',
      ano: 2018,
      carroceria: 'Moto',
      arCondicionado: false,
      portas: 0,
      cambio: 'Manual',
      cilindrada: 160,
    };

    const result = await platformValidator.validateAll(vehicle);

    expect(result.transport.uberX).toBe(false);
    expect(result.delivery.ifoodMoto).toBe(true);
    expect(result.delivery.loggiMoto).toBe(true);

    // Verify Prompt asked about Motos
    const calledPrompt = chatSpy.mock.calls[0][0][0].content;
    expect(calledPrompt).toContain('IFOOD / LOGGI (Moto)');
  });

  it('Scenario 4: Old Vehicle (Fusca 1980) - Should Fail All', async () => {
    chatSpy.mockResolvedValue(
      JSON.stringify({
        transport: { uberX: false },
        delivery: { ifoodMoto: false },
        reasoning: 'Veículo antigo demais.',
        confidence: 1.0,
      })
    );

    const vehicle = {
      marca: 'Volkswagen',
      modelo: 'Fusca',
      ano: 1980,
      carroceria: 'Hatch',
      arCondicionado: false,
      portas: 2,
      cambio: 'Manual',
    };

    const result = await platformValidator.validateAll(vehicle);

    expect(result.transport.uberX).toBe(false);
    expect(result.delivery.mercadoEnviosFlex).toBe(false); // Too old
  });

  it('Scenario 5: Multi-App Config Integrity', async () => {
    // Access config directly to verify structure
    const rules = PlatformRulesConfig;

    expect(rules.delivery.lalamove.moto).toBeDefined();
    expect(rules.delivery.shopee.entregador).toBeDefined();
    expect(rules.delivery.mercadoEnvios.flex).toBeDefined();

    // Verify Logic Helper
    const cutoff = rules.getCutoffYear(rules.delivery.mercadoEnvios.flex);
    expect(cutoff).toBe(currentYear - 15);
  });
});
