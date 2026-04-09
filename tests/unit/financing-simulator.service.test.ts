import { describe, expect, it } from 'vitest';
import {
  simulateFinancing,
  formatFinancingSimulation,
} from '../../src/services/financing-simulator.service';

describe('financing-simulator.service', () => {
  it('includes market-average reference details in the disclaimer', () => {
    const simulation = simulateFinancing(80000, 16000, 0);

    expect(simulation.disclaimer).toContain('Banco Central do Brasil');
    expect(simulation.disclaimer).toContain('2.03% a.m.');
    expect(simulation.disclaimer).toContain('análise de crédito');
  });

  it('formats both the applied reference rate and the Bacen market average', () => {
    const simulation = simulateFinancing(80000, 0, 0);
    const message = formatFinancingSimulation(simulation, 'RENAULT CAPTUR 2019');

    expect(message).toContain('Taxa de referência nesta simulação');
    expect(message).toContain('Média de mercado Bacen');
    expect(message).toContain('2.03% a.m.');
  });
});
