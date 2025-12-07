/**
 * Intent Detector Unit Tests
 * 
 * Tests for the intent detection functions used by the VehicleExpertAgent.
 */

import { describe, it, expect } from 'vitest';
import {
    detectUserQuestion,
    detectAffirmativeResponse,
    detectNegativeResponse,
    detectPostRecommendationIntent,
    isPostRecommendationResponse,
} from '../../../src/agents/vehicle-expert/intent-detector';

describe('Intent Detector', () => {

    // ============================================
    // detectUserQuestion tests
    // ============================================
    describe('detectUserQuestion', () => {
        it('should detect questions ending with ?', () => {
            expect(detectUserQuestion('Vocês tem SUV?')).toBe(true);
            expect(detectUserQuestion('Quanto custa?')).toBe(true);
        });

        it('should detect questions starting with question words', () => {
            expect(detectUserQuestion('Qual a diferença entre SUV e sedan?')).toBe(true);
            expect(detectUserQuestion('Como funciona o financiamento?')).toBe(true);
            expect(detectUserQuestion('Quanto vocês tem de SUV?')).toBe(true);
            expect(detectUserQuestion('Onde fica a loja?')).toBe(true);
        });

        it('should detect "vocês tem" pattern', () => {
            expect(detectUserQuestion('Vocês tem Civic')).toBe(true);
            expect(detectUserQuestion('Você tem pickup')).toBe(true);
        });

        it('should detect "tem disponível" pattern', () => {
            expect(detectUserQuestion('Tem disponível algum SUV?')).toBe(true);
        });

        it('should NOT detect simple statements as questions', () => {
            expect(detectUserQuestion('Quero um SUV')).toBe(false);
            expect(detectUserQuestion('Meu orçamento é 50 mil')).toBe(false);
            expect(detectUserQuestion('Sim')).toBe(false);
        });
    });

    // ============================================
    // detectAffirmativeResponse tests
    // ============================================
    describe('detectAffirmativeResponse', () => {
        it('should detect short affirmative words', () => {
            expect(detectAffirmativeResponse('sim')).toBe(true);
            expect(detectAffirmativeResponse('Sim')).toBe(true);
            expect(detectAffirmativeResponse('SIM')).toBe(true);
            expect(detectAffirmativeResponse('ok')).toBe(true);
            expect(detectAffirmativeResponse('blz')).toBe(true);
            expect(detectAffirmativeResponse('bora')).toBe(true);
            expect(detectAffirmativeResponse('pode')).toBe(true);
            expect(detectAffirmativeResponse('quero')).toBe(true);
        });

        it('should detect phrases with affirmative words', () => {
            expect(detectAffirmativeResponse('Sim, pode mostrar')).toBe(true);
            expect(detectAffirmativeResponse('Com certeza')).toBe(true);
            expect(detectAffirmativeResponse('Pode ser')).toBe(true);
            expect(detectAffirmativeResponse('Tenho interesse')).toBe(true);
        });

        it('should detect common voice transcription variations', () => {
            expect(detectAffirmativeResponse('siiim')).toBe(true);
            expect(detectAffirmativeResponse('siim')).toBe(true);
            expect(detectAffirmativeResponse('sss')).toBe(true);
        });

        it('should NOT detect negative phrases as affirmative', () => {
            expect(detectAffirmativeResponse('não quero')).toBe(false);
            expect(detectAffirmativeResponse('agora não')).toBe(false);
            expect(detectAffirmativeResponse('não tenho interesse')).toBe(false);
        });

        it('should handle punctuation correctly', () => {
            expect(detectAffirmativeResponse('sim!')).toBe(true);
            expect(detectAffirmativeResponse('ok.')).toBe(true);
            expect(detectAffirmativeResponse('pode?')).toBe(true);
        });
    });

    // ============================================
    // detectNegativeResponse tests
    // ============================================
    describe('detectNegativeResponse', () => {
        it('should detect negative words', () => {
            expect(detectNegativeResponse('não')).toBe(true);
            expect(detectNegativeResponse('nao')).toBe(true);
            expect(detectNegativeResponse('n')).toBe(true);
            expect(detectNegativeResponse('nunca')).toBe(true);
        });

        it('should detect negative phrases', () => {
            expect(detectNegativeResponse('não quero')).toBe(true);
            expect(detectNegativeResponse('não, obrigado')).toBe(true);
            expect(detectNegativeResponse('agora não')).toBe(true);
            expect(detectNegativeResponse('talvez depois')).toBe(true);
        });

        it('should NOT detect affirmative as negative', () => {
            expect(detectNegativeResponse('sim')).toBe(false);
            expect(detectNegativeResponse('pode')).toBe(false);
            expect(detectNegativeResponse('quero')).toBe(false);
        });
    });

    // ============================================
    // detectPostRecommendationIntent tests
    // ============================================
    describe('detectPostRecommendationIntent', () => {

        describe('want_financing', () => {
            it('should detect financing intent', () => {
                expect(detectPostRecommendationIntent('Quero financiar')).toBe('want_financing');
                expect(detectPostRecommendationIntent('Gostei, vou financiar')).toBe('want_financing');
                expect(detectPostRecommendationIntent('Posso parcelar?')).toBe('want_financing');
                expect(detectPostRecommendationIntent('Qual a entrada?')).toBe('want_financing');
                expect(detectPostRecommendationIntent('Quero simular')).toBe('want_financing');
            });
        });

        describe('want_tradein', () => {
            it('should detect trade-in intent', () => {
                expect(detectPostRecommendationIntent('Tenho um carro para dar na troca')).toBe('want_tradein');
                expect(detectPostRecommendationIntent('Meu carro entra na troca')).toBe('want_tradein');
                expect(detectPostRecommendationIntent('Aceita troca?')).toBe('want_tradein');
                expect(detectPostRecommendationIntent('Quero dar na troca')).toBe('want_tradein');
            });
        });

        describe('want_schedule', () => {
            it('should detect schedule intent', () => {
                expect(detectPostRecommendationIntent('Quero agendar visita')).toBe('want_schedule');
                expect(detectPostRecommendationIntent('Falar com vendedor')).toBe('want_schedule');
                expect(detectPostRecommendationIntent('Onde fica a loja?')).toBe('want_schedule');
                expect(detectPostRecommendationIntent('Qual o endereço?')).toBe('want_schedule');
            });
        });

        describe('want_details', () => {
            it('should detect details intent', () => {
                expect(detectPostRecommendationIntent('Mais detalhes')).toBe('want_details');
                expect(detectPostRecommendationIntent('Qual a quilometragem?')).toBe('want_details');
                expect(detectPostRecommendationIntent('Interessei nesse')).toBe('want_details');
                expect(detectPostRecommendationIntent('Conta mais')).toBe('want_details');
            });
        });

        describe('want_others', () => {
            it('should detect want others intent', () => {
                expect(detectPostRecommendationIntent('Tem outras opções?')).toBe('want_others');
                expect(detectPostRecommendationIntent('Muito caro')).toBe('want_others');
                expect(detectPostRecommendationIntent('Algo mais barato')).toBe('want_others');
                expect(detectPostRecommendationIntent('Não gostei')).toBe('want_others');
                expect(detectPostRecommendationIntent('Algo parecido')).toBe('want_others');
                expect(detectPostRecommendationIntent('Similar')).toBe('want_others');
            });

            it('should detect budget-related requests as want_others', () => {
                expect(detectPostRecommendationIntent('Tem algo até 50 mil?')).toBe('want_others');
                expect(detectPostRecommendationIntent('30000')).toBe('want_others');
            });
        });

        describe('acknowledgment', () => {
            it('should detect acknowledgments', () => {
                expect(detectPostRecommendationIntent('ok')).toBe('acknowledgment');
                expect(detectPostRecommendationIntent('entendi')).toBe('acknowledgment');
                expect(detectPostRecommendationIntent('legal')).toBe('acknowledgment');
                expect(detectPostRecommendationIntent('valeu')).toBe('acknowledgment');
            });
        });

        describe('none', () => {
            it('should return none for unclear intent', () => {
                expect(detectPostRecommendationIntent('Bom dia')).toBe('none');
                expect(detectPostRecommendationIntent('Oi')).toBe('none');
            });
        });
    });

    // ============================================
    // isPostRecommendationResponse tests
    // ============================================
    describe('isPostRecommendationResponse', () => {
        it('should detect financing-related response', () => {
            expect(isPostRecommendationResponse('Quero financiar', {})).toBe(true);
            expect(isPostRecommendationResponse('Entrada de 10 mil', { wantsFinancing: true })).toBe(true);
        });

        it('should detect trade-in related response', () => {
            expect(isPostRecommendationResponse('Tenho um carro', {})).toBe(true);
            expect(isPostRecommendationResponse('É um Gol 2015', { hasTradeIn: true })).toBe(true);
        });

        it('should detect scheduling related response', () => {
            expect(isPostRecommendationResponse('Quero agendar', {})).toBe(true);
            expect(isPostRecommendationResponse('Quero visitar', {})).toBe(true);
        });

        it('should NOT detect unrelated messages', () => {
            expect(isPostRecommendationResponse('Bom dia', {})).toBe(false);
            expect(isPostRecommendationResponse('Oi', {})).toBe(false);
        });
    });
});
