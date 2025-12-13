/**
 * Suggestion Response Handler
 *
 * Handles user responses when the bot is waiting for a yes/no confirmation
 * after offering alternatives (Uber X, alternative years, 7-seater alternatives, etc.)
 *
 * Follows clean code principles:
 * - Single Responsibility: Each sub-handler handles one type of suggestion
 * - Guard Clauses: Early returns for cleaner flow
 * - Strategy Pattern: Array of handlers tried in order
 */

import { logger } from '../../../lib/logger';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile } from '../../../types/state.types';
import { ConversationContext, ConversationResponse } from '../../../types/conversation.types';
import { formatRecommendations as formatRecommendationsUtil } from '../formatters';
import {
    detectUserQuestion,
    detectAffirmativeResponse,
    detectNegativeResponse,
} from '../intent-detector';
import { buildResponse } from '../utils/response-builder';

/**
 * Context for suggestion response handling
 */
export interface SuggestionResponseContext {
    userMessage: string;
    wasWaitingForSuggestionResponse: boolean;
    waitingForUberXAlternatives: boolean;
    availableYears?: number[];
    searchedItem?: string;
    extracted: {
        extracted: Partial<CustomerProfile>;
    };
    updatedProfile: Partial<CustomerProfile>;
    context: ConversationContext;
    startTime: number;
    getAppCategoryName: (profile: Partial<CustomerProfile>, category: 'x' | 'black' | 'comfort') => string;
}

/**
 * Result from suggestion response handler
 */
export interface SuggestionHandlerResult {
    handled: boolean;
    response?: ConversationResponse;
    /** Updated profile flags to apply */
    profileUpdates?: Partial<CustomerProfile>;
    /** If true, continue to normal flow processing */
    continueProcessing?: boolean;
}

// buildResponse imported from utils

// ============================================================================
// SUB-HANDLERS
// ============================================================================

/**
 * A) Handle when user asks a NEW question instead of yes/no
 */
function handleNewQuestion(ctx: SuggestionResponseContext): SuggestionHandlerResult {
    const isNewQuestion = detectUserQuestion(ctx.userMessage);
    const hasNewPreferences =
        Object.keys(ctx.extracted.extracted).length > 0 &&
        (ctx.extracted.extracted.bodyType ||
            ctx.extracted.extracted.brand ||
            ctx.extracted.extracted.model ||
            ctx.extracted.extracted.budget);

    if (!isNewQuestion && !hasNewPreferences) {
        return { handled: false };
    }

    logger.info(
        {
            userMessage: ctx.userMessage,
            isNewQuestion,
            hasNewPreferences,
            extracted: ctx.extracted.extracted,
        },
        'User asked new question while waiting for suggestion response, processing normally'
    );

    return {
        handled: true,
        continueProcessing: true,
        profileUpdates: {
            _waitingForSuggestionResponse: false,
            _searchedItem: undefined,
            _availableYears: undefined,
            _waitingForUberXAlternatives: false,
        },
    };
}

/**
 * B) Handle Uber X/99Pop alternatives acceptance
 */
async function handleUberXAlternatives(ctx: SuggestionResponseContext): Promise<SuggestionHandlerResult> {
    if (!ctx.waitingForUberXAlternatives) {
        return { handled: false };
    }

    const userAccepts = detectAffirmativeResponse(ctx.userMessage);
    if (!userAccepts) {
        return { handled: false };
    }

    const appCategory = ctx.getAppCategoryName(ctx.updatedProfile, 'x');
    logger.info(`User accepted ${appCategory} alternatives - searching eligible vehicles`);

    const uberXVehicles = await vehicleSearchAdapter.search('', {
        aptoUber: true,
        limit: 10,
    });

    if (uberXVehicles.length > 0) {
        const formattedResponse = await formatRecommendationsUtil(
            uberXVehicles,
            ctx.updatedProfile,
            'recommendation'
        );

        const intro = `Perfeito! Encontrei ${uberXVehicles.length} veículos aptos para ${appCategory}:\n\n`;

        return {
            handled: true,
            response: buildResponse(intro + formattedResponse, {
                ...ctx.extracted.extracted,
                _waitingForUberXAlternatives: false,
                _showedRecommendation: true,
                _lastSearchType: 'recommendation' as const,
                _lastShownVehicles: uberXVehicles.map(r => ({
                    vehicleId: r.vehicleId,
                    brand: r.vehicle.brand,
                    model: r.vehicle.model,
                    year: r.vehicle.year,
                    price: r.vehicle.price,
                    bodyType: r.vehicle.bodyType,
                })),
            }, {
                canRecommend: true,
                recommendations: uberXVehicles,
                nextMode: 'recommendation',
                startTime: ctx.startTime,
            }),
        };
    }

    // No vehicles found
    return {
        handled: true,
        response: buildResponse(
            `Desculpe, no momento também não temos veículos aptos para ${appCategory} disponíveis. 😕\n\nPosso te ajudar a encontrar outro tipo de veículo?`,
            { ...ctx.extracted.extracted, _waitingForUberXAlternatives: false },
            {
                needsMoreInfo: ['budget', 'usage'],
                nextMode: 'discovery',
                startTime: ctx.startTime,
                llmUsed: 'gpt-4o-mini',
            }
        ),
    };
}

/**
 * C) Handle alternative year acceptance
 */
async function handleAlternativeYears(ctx: SuggestionResponseContext): Promise<SuggestionHandlerResult> {
    const userAccepts = detectAffirmativeResponse(ctx.userMessage);
    if (!userAccepts) {
        return { handled: false };
    }

    const hasAvailableYears = ctx.availableYears && ctx.availableYears.length > 0;
    if (!hasAvailableYears || !ctx.searchedItem) {
        return { handled: false };
    }

    const firstAvailableYear = ctx.availableYears![0]; // Most recent year

    logger.info(
        { searchedItem: ctx.searchedItem, firstAvailableYear },
        'User accepted to see alternative year - showing vehicle directly'
    );

    const results = await vehicleSearchAdapter.search(ctx.searchedItem, {
        model: ctx.searchedItem,
        minYear: firstAvailableYear,
        limit: 5,
    });

    const matchingResults = results.filter(r => r.vehicle.year === firstAvailableYear);

    if (matchingResults.length > 0) {
        const formattedResponse = await formatRecommendationsUtil(
            matchingResults,
            {
                ...ctx.updatedProfile,
                _availableYears: undefined,
                _waitingForSuggestionResponse: false,
                _searchedItem: undefined,
            },
            'specific'
        );

        return {
            handled: true,
            response: buildResponse(formattedResponse, {
                ...ctx.updatedProfile,
                minYear: firstAvailableYear,
                _availableYears: undefined,
                _waitingForSuggestionResponse: false,
                _searchedItem: undefined,
                _showedRecommendation: true,
                _lastSearchType: 'specific' as const,
                _lastShownVehicles: matchingResults.map(r => ({
                    vehicleId: r.vehicleId,
                    brand: r.vehicle.brand,
                    model: r.vehicle.model,
                    year: r.vehicle.year,
                    price: r.vehicle.price,
                })),
            }, {
                canRecommend: true,
                recommendations: matchingResults,
                nextMode: 'recommendation',
                startTime: ctx.startTime,
                confidence: 0.95,
                llmUsed: 'gpt-4o-mini',
            }),
        };
    }

    return { handled: false };
}

/**
 * D) Handle 7-seater → 5-seater SUV alternative acceptance
 */
async function handleSevenSeaterAlternative(ctx: SuggestionResponseContext): Promise<SuggestionHandlerResult> {
    const userAccepts = detectAffirmativeResponse(ctx.userMessage);
    if (!userAccepts) {
        return { handled: false };
    }

    const wasLookingForSevenSeater =
        ctx.searchedItem?.includes('lugares') || ctx.context.profile?.minSeats;

    if (!wasLookingForSevenSeater) {
        return { handled: false };
    }

    const existingBudget = ctx.extracted.extracted.budget || ctx.context.profile?.budget;

    // If we have budget, search immediately
    if (existingBudget) {
        const altProfile = {
            ...ctx.extracted.extracted,
            budget: existingBudget,
            _waitingForSuggestionResponse: false,
            _searchedItem: undefined,
            minSeats: undefined,
            people: undefined,
            _acceptedFiveSeaterAlternative: true,
            bodyType: 'suv' as const,
        };

        const results = await vehicleSearchAdapter.search('suv espaçoso', {
            bodyType: 'suv',
            limit: 5,
            maxPrice: existingBudget,
        });

        if (results.length > 0) {
            const formattedResponse = await formatRecommendationsUtil(results, altProfile, 'recommendation');

            return {
                handled: true,
                response: buildResponse(
                    `Entendido! Considerando seu orçamento de R$ ${existingBudget.toLocaleString('pt-BR')}, encontrei estas opções de SUVs espaçosos:\n\n` + formattedResponse,
                    altProfile,
                    {
                        canRecommend: true,
                        recommendations: results,
                        nextMode: 'recommendation',
                        startTime: ctx.startTime,
                    }
                ),
            };
        }
    }

    // No budget yet - ask for it
    const altProfile = {
        ...ctx.extracted.extracted,
        _waitingForSuggestionResponse: false,
        _searchedItem: undefined,
        minSeats: undefined,
        people: undefined,
        _acceptedFiveSeaterAlternative: true,
        bodyType: 'suv' as const,
        priorities: [...(ctx.extracted.extracted.priorities || []), 'espaco'],
    };

    return {
        handled: true,
        response: buildResponse(
            `Ótimo! Vou te mostrar SUVs e opções espaçosas que temos disponíveis! 🚗\n\n💰 Até quanto você pretende investir?`,
            altProfile,
            {
                needsMoreInfo: ['budget'],
                nextMode: 'clarification',
                startTime: ctx.startTime,
                llmUsed: 'gpt-4o-mini',
            }
        ),
    };
}

/**
 * E) Handle generic acceptance (start discovery questions)
 */
function handleGenericAccept(ctx: SuggestionResponseContext): SuggestionHandlerResult {
    const userAccepts = detectAffirmativeResponse(ctx.userMessage);
    if (!userAccepts) {
        return { handled: false };
    }

    return {
        handled: true,
        response: buildResponse(
            `Ótimo! Vou te fazer algumas perguntas rápidas para encontrar o carro ideal pra você. 🚗\n\n💰 Até quanto você pretende investir no carro?`,
            {
                ...ctx.extracted.extracted,
                _waitingForSuggestionResponse: false,
                _searchedItem: undefined,
            },
            {
                needsMoreInfo: ['budget', 'usage'],
                nextMode: 'discovery',
                startTime: ctx.startTime,
                llmUsed: 'gpt-4o-mini',
            }
        ),
    };
}

/**
 * F) Handle decline
 */
function handleDecline(ctx: SuggestionResponseContext): SuggestionHandlerResult {
    const userDeclines = detectNegativeResponse(ctx.userMessage);
    if (!userDeclines) {
        return { handled: false };
    }

    return {
        handled: true,
        response: buildResponse(
            `Sem problemas! 🙂 Se mudar de ideia ou quiser ver outros veículos, é só me chamar!`,
            {
                ...ctx.extracted.extracted,
                _waitingForSuggestionResponse: false,
                _searchedItem: undefined,
            },
            {
                nextMode: 'discovery',
                startTime: ctx.startTime,
                confidence: 0.8,
                llmUsed: 'gpt-4o-mini',
            }
        ),
    };
}

/**
 * G) Handle ambiguous response (neither yes nor no)
 */
function handleAmbiguous(ctx: SuggestionResponseContext): SuggestionHandlerResult {
    logger.info(
        { userMessage: ctx.userMessage },
        'Ambiguous response to suggestion - clearing flags and continuing'
    );

    return {
        handled: true,
        continueProcessing: true,
        profileUpdates: {
            _waitingForSuggestionResponse: false,
            _searchedItem: undefined,
            _waitingForUberXAlternatives: false,
        },
    };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Main suggestion response handler
 *
 * Processes user responses when `_waitingForSuggestionResponse = true`
 *
 * @param ctx - Suggestion response context
 * @returns Handler result with response or profile updates
 */
export async function handleSuggestionResponse(
    ctx: SuggestionResponseContext
): Promise<SuggestionHandlerResult> {
    // Guard: Not waiting for suggestion response
    if (!ctx.wasWaitingForSuggestionResponse) {
        return { handled: false };
    }

    // Priority 1: Check for new question (takes priority over yes/no)
    const newQuestionResult = handleNewQuestion(ctx);
    if (newQuestionResult.handled) {
        return newQuestionResult;
    }

    // Priority 2: Uber X alternatives (specific flag)
    const uberResult = await handleUberXAlternatives(ctx);
    if (uberResult.handled) {
        return uberResult;
    }

    // Priority 3: Alternative years
    const yearsResult = await handleAlternativeYears(ctx);
    if (yearsResult.handled) {
        return yearsResult;
    }

    // Priority 4: Seven seater alternative
    const sevenSeaterResult = await handleSevenSeaterAlternative(ctx);
    if (sevenSeaterResult.handled) {
        return sevenSeaterResult;
    }

    // Priority 5: Generic accept
    const genericResult = handleGenericAccept(ctx);
    if (genericResult.handled) {
        return genericResult;
    }

    // Priority 6: Decline
    const declineResult = handleDecline(ctx);
    if (declineResult.handled) {
        return declineResult;
    }

    // Fallback: Ambiguous response
    return handleAmbiguous(ctx);
}
