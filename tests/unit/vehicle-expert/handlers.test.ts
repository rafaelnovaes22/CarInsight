/**
 * Post-Recommendation Handlers Unit Tests
 * 
 * Tests for the handlers that process user intents after showing vehicle recommendations.
 */

import { describe, it, expect } from 'vitest';
import {
    handleFinancing,
    handleTradeIn,
    handleSchedule,
    handleDetails,
    handleAcknowledgment,
    handleInterest,
    routePostRecommendationIntent,
    PostRecommendationContext,
    ShownVehicle,
} from '../../../src/agents/vehicle-expert/handlers';
import { ConversationContext } from '../../../src/types/conversation.types';

// Mock data for tests
const mockVehicle: ShownVehicle = {
    vehicleId: 'v123',
    brand: 'HONDA',
    model: 'CIVIC',
    year: 2020,
    price: 89990,
};

const mockContext: PostRecommendationContext = {
    userMessage: 'Quero financiar',
    lastShownVehicles: [mockVehicle],
    lastSearchType: 'specific',
    extracted: { extracted: {} },
    updatedProfile: {},
    context: {
        userId: 'user123',
        mode: 'recommendation',
        messages: [],
        profile: {},
        metadata: { messageCount: 5 },
    } as unknown as ConversationContext,
    startTime: Date.now(),
};

describe('Post-Recommendation Handlers', () => {

    // ============================================
    // handleFinancing tests
    // ============================================
    describe('handleFinancing', () => {
        it('should return handled=true', () => {
            const result = handleFinancing(mockContext);
            expect(result.handled).toBe(true);
        });

        it('should include vehicle name in response', () => {
            const result = handleFinancing(mockContext);
            expect(result.response?.response).toContain('HONDA CIVIC');
        });

        it('should include vehicle price in response', () => {
            const result = handleFinancing(mockContext);
            expect(result.response?.response).toContain('89.990');
        });

        it('should set wantsFinancing=true in extractedPreferences', () => {
            const result = handleFinancing(mockContext);
            expect(result.response?.extractedPreferences?.wantsFinancing).toBe(true);
        });

        it('should request financing info', () => {
            const result = handleFinancing(mockContext);
            expect(result.response?.needsMoreInfo).toContain('financingDownPayment');
            expect(result.response?.needsMoreInfo).toContain('tradeIn');
        });

        it('should set nextMode to negotiation', () => {
            const result = handleFinancing(mockContext);
            expect(result.response?.nextMode).toBe('negotiation');
        });
    });

    // ============================================
    // handleTradeIn tests
    // ============================================
    describe('handleTradeIn', () => {
        it('should return handled=true', () => {
            const result = handleTradeIn(mockContext);
            expect(result.handled).toBe(true);
        });

        it('should set hasTradeIn=true in extractedPreferences', () => {
            const result = handleTradeIn(mockContext);
            expect(result.response?.extractedPreferences?.hasTradeIn).toBe(true);
        });

        it('should request trade-in vehicle info', () => {
            const result = handleTradeIn(mockContext);
            // Handler asks for model and year (brand can be inferred from model)
            expect(result.response?.needsMoreInfo).toContain('tradeInModel');
            expect(result.response?.needsMoreInfo).toContain('tradeInYear');
        });

        it('should set nextMode to negotiation', () => {
            const result = handleTradeIn(mockContext);
            expect(result.response?.nextMode).toBe('negotiation');
        });
    });

    // ============================================
    // handleSchedule tests
    // ============================================
    describe('handleSchedule', () => {
        it('should return handled=true', () => {
            const result = handleSchedule(mockContext);
            expect(result.handled).toBe(true);
        });

        it('should mention Robust Car in response', () => {
            const result = handleSchedule(mockContext);
            expect(result.response?.response).toContain('Robust Car');
        });

        it('should ask for user name', () => {
            const result = handleSchedule(mockContext);
            expect(result.response?.response).toContain('nome completo');
        });
    });

    // ============================================
    // handleDetails tests
    // ============================================
    describe('handleDetails', () => {
        it('should return handled=true', () => {
            const result = handleDetails(mockContext);
            expect(result.handled).toBe(true);
        });

        it('should mention the vehicle when showing single vehicle', () => {
            const result = handleDetails(mockContext);
            expect(result.response?.response).toContain('HONDA CIVIC 2020');
        });

        it('should list vehicles when multiple shown', () => {
            const multiVehicleContext = {
                ...mockContext,
                lastShownVehicles: [
                    mockVehicle,
                    { ...mockVehicle, vehicleId: 'v456', model: 'COROLLA', brand: 'TOYOTA' },
                ],
            };
            const result = handleDetails(multiVehicleContext);
            expect(result.response?.response).toContain('HONDA CIVIC');
            expect(result.response?.response).toContain('TOYOTA COROLLA');
        });

        it('should suggest talking to seller', () => {
            const result = handleDetails(mockContext);
            expect(result.response?.response).toContain('vendedor');
        });
    });

    // ============================================
    // handleAcknowledgment tests
    // ============================================
    describe('handleAcknowledgment', () => {
        it('should return handled=true', () => {
            const result = handleAcknowledgment(mockContext);
            expect(result.handled).toBe(true);
        });

        it('should offer next steps', () => {
            const result = handleAcknowledgment(mockContext);
            expect(result.response?.response).toContain('financiamento');
            expect(result.response?.response).toContain('Agendar');
        });
    });

    // ============================================
    // handleInterest tests
    // ============================================
    describe('handleInterest', () => {
        it('should return handled=true', () => {
            const result = handleInterest(mockContext);
            expect(result.handled).toBe(true);
        });

        it('should include vehicle name in response', () => {
            const result = handleInterest(mockContext);
            expect(result.response?.response).toContain('HONDA CIVIC 2020');
        });

        it('should include vehicle price in response', () => {
            const result = handleInterest(mockContext);
            expect(result.response?.response).toContain('89.990');
        });

        it('should NOT include URL/link in response', () => {
            const result = handleInterest(mockContext);
            // The response should NOT have a link - user already saw it
            expect(result.response?.response).not.toContain('http');
            expect(result.response?.response).not.toContain('🔗');
        });

        it('should ask about payment method', () => {
            const result = handleInterest(mockContext);
            expect(result.response?.response).toContain('pagar');
        });

        it('should offer payment options', () => {
            const result = handleInterest(mockContext);
            expect(result.response?.response).toContain('vista');
            expect(result.response?.response).toContain('Financiamento');
            expect(result.response?.response).toContain('troca');
        });

        it('should set nextMode to negotiation', () => {
            const result = handleInterest(mockContext);
            expect(result.response?.nextMode).toBe('negotiation');
        });

        it('should select correct vehicle when user mentions model name', () => {
            const multiVehicleContext = {
                ...mockContext,
                userMessage: 'Gostei do Corolla',
                lastShownVehicles: [
                    mockVehicle,
                    { ...mockVehicle, vehicleId: 'v456', model: 'COROLLA', brand: 'TOYOTA', price: 95990 },
                ],
            };
            const result = handleInterest(multiVehicleContext);
            expect(result.response?.response).toContain('TOYOTA COROLLA');
            expect(result.response?.response).toContain('95.990');
        });
    });

    // ============================================
    // routePostRecommendationIntent tests
    // ============================================
    describe('routePostRecommendationIntent', () => {
        it('should route want_financing to handleFinancing', () => {
            const result = routePostRecommendationIntent('want_financing', mockContext);
            expect(result.handled).toBe(true);
            expect(result.response?.extractedPreferences?.wantsFinancing).toBe(true);
        });

        it('should route want_tradein to handleTradeIn', () => {
            const result = routePostRecommendationIntent('want_tradein', mockContext);
            expect(result.handled).toBe(true);
            expect(result.response?.extractedPreferences?.hasTradeIn).toBe(true);
        });

        it('should route want_schedule to handleSchedule', () => {
            const result = routePostRecommendationIntent('want_schedule', mockContext);
            expect(result.handled).toBe(true);
            expect(result.response?.response).toContain('Robust Car');
        });

        it('should route want_details to handleDetails', () => {
            const result = routePostRecommendationIntent('want_details', mockContext);
            expect(result.handled).toBe(true);
        });

        it('should route acknowledgment to handleAcknowledgment', () => {
            const result = routePostRecommendationIntent('acknowledgment', mockContext);
            expect(result.handled).toBe(true);
        });

        it('should route want_interest to handleInterest', () => {
            const result = routePostRecommendationIntent('want_interest', mockContext);
            expect(result.handled).toBe(true);
            expect(result.response?.response).toContain('Como você pretende pagar');
        });

        it('should return handled=false for want_others (handled separately)', () => {
            const result = routePostRecommendationIntent('want_others', mockContext);
            expect(result.handled).toBe(false);
        });

        it('should return handled=false for none', () => {
            const result = routePostRecommendationIntent('none', mockContext);
            expect(result.handled).toBe(false);
        });
    });
});
