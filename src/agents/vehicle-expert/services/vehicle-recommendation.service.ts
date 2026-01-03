
import { logger } from '../../../lib/logger';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';
import { buildSearchQuery as buildSearchQueryUtil } from '../builders';
import { isSevenSeater } from '../constants';

export interface RecommendationResult {
    recommendations: VehicleRecommendation[];
    noPickupsFound?: boolean;
    wantsPickup?: boolean;
    noMotosFound?: boolean;
    wantsMoto?: boolean;
    noSevenSeaters?: boolean;
    requiredSeats?: number;
}

export class VehicleRecommendationService {
    /**
     * Get vehicle recommendations based on profile
     * Returns { recommendations, noPickupsFound, noSevenSeaters } to indicate if category was not found
     */
    async getRecommendations(profile: Partial<CustomerProfile>): Promise<RecommendationResult> {
        try {
            // Build search query
            const query = buildSearchQueryUtil(profile);

            // Detect Uber requirements from profile
            const isUberBlack =
                profile.usoPrincipal === 'uber' &&
                (profile.priorities?.includes('uber_black') ||
                    profile.priorities?.includes('black') ||
                    profile.tipoUber === 'black');

            const isUberX = profile.usoPrincipal === 'uber' && !isUberBlack;

            // Detect family requirements (only if explicitly mentioned, not just by people count)
            const isFamily =
                profile.usoPrincipal === 'familia' ||
                profile.priorities?.includes('familia') ||
                profile.priorities?.includes('cadeirinha') ||
                profile.priorities?.includes('crianca');

            // Detect pickup/work requirements - check profile, search text AND context messages
            const pickupKeywords = [
                'pickup',
                'picape',
                'caminhonete',
                'caçamba',
                'cacamba',
                'carga',
                'obra',
                'material',
                'construção',
                'construcao',
                'carregar',
                'entulho',
            ];
            const searchTextLower = query.searchText.toLowerCase();
            const hasPickupInText = pickupKeywords.some(kw => searchTextLower.includes(kw));

            // Also check profile usoPrincipal and usage for work-related terms
            const usageText = `${profile.usoPrincipal || ''} ${profile.usage || ''}`.toLowerCase();
            const hasWorkUsage = usageText.includes('trabalho') || usageText.includes('obra');

            // Check priorities array for any pickup-related terms
            const prioritiesText = (profile.priorities || []).join(' ').toLowerCase();
            const hasPickupInPriorities = pickupKeywords.some(kw => prioritiesText.includes(kw));

            const wantsPickup =
                profile.bodyType === 'pickup' ||
                hasPickupInText ||
                hasPickupInPriorities ||
                (hasWorkUsage && pickupKeywords.some(kw => usageText.includes(kw)));

            // Detect moto requirements
            const motoKeywords = [
                'moto',
                'motocicleta',
                'scooter',
                'biz',
                'titan',
                'fan',
                'bros',
                'pcx',
                'fazer',
                'cb',
                'xre',
                'yamaha',
                'honda',
            ];
            const hasMotoInText = motoKeywords.some(kw => searchTextLower.includes(kw));
            const hasMotoInPriorities = motoKeywords.some(kw => prioritiesText.includes(kw));

            const wantsMoto = profile.bodyType === 'moto' || hasMotoInText || hasMotoInPriorities;

            logger.info(
                {
                    wantsPickup,
                    wantsMoto,
                    bodyType: profile.bodyType,
                    searchTextLower,
                    hasPickupInText,
                    hasMotoInText,
                    usageText,
                    hasWorkUsage,
                },
                'Vehicle type detection check'
            );

            const isWork =
                profile.usoPrincipal === 'trabalho' ||
                profile.usage === 'trabalho' ||
                profile.priorities?.includes('trabalho');

            // Search vehicles - include brand/model filter for specific requests
            const results = await vehicleSearchAdapter.search(query.searchText, {
                maxPrice: query.filters.maxPrice,
                minYear: query.filters.minYear,
                bodyType: wantsMoto ? 'moto' : wantsPickup ? 'pickup' : query.filters.bodyType?.[0],
                brand: query.filters.brand?.[0], // Filtrar por marca quando especificada
                model: query.filters.model?.[0], // Filtrar por modelo quando especificado
                limit: 10, // Get more to filter
                // Apply Uber filters
                aptoUber: isUberX || undefined,
                aptoUberBlack: isUberBlack || undefined,
                // Apply family filter (only if family, not for pickup/work/moto)
                aptoFamilia: (isFamily && !wantsPickup && !wantsMoto) || undefined,
                // Apply work filter
                aptoTrabalho: isWork || undefined,
            });

            // Se não encontrou motos e o usuário quer moto, informar
            if (wantsMoto && results.length === 0) {
                logger.info({ profile }, 'No motos found in inventory');
                return { recommendations: [], noMotosFound: true, wantsMoto: true };
            }

            // Se não encontrou pickups e o usuário quer pickup, informar
            if (wantsPickup && results.length === 0) {
                logger.info({ profile }, 'No pickups found in inventory');
                return { recommendations: [], noPickupsFound: true, wantsPickup: true };
            }

            // Post-filter: apply minimum seats requirement (RIGOROSO)
            const requiredSeats = profile.minSeats;
            if (requiredSeats && requiredSeats >= 7) {
                logger.info(
                    { requiredSeats, resultsBeforeFilter: results.length },
                    'Filtering for 7+ seat vehicles'
                );

                // Filtrar APENAS veículos de 7 lugares
                const sevenSeaterResults = results.filter(rec => {
                    const modelLower = (rec.vehicle.model || '').toLowerCase();
                    return isSevenSeater(modelLower);
                });

                logger.info(
                    {
                        requiredSeats,
                        sevenSeaterResults: sevenSeaterResults.length,
                        filteredModels: sevenSeaterResults.map(r => r.vehicle.model),
                    },
                    'Seven seater filter results'
                );

                if (sevenSeaterResults.length === 0) {
                    // Não encontrou veículos de 7 lugares - NÃO retornar alternativas automaticamente
                    return { recommendations: [], noSevenSeaters: true, requiredSeats };
                }

                // Retornar APENAS os veículos de 7 lugares
                return { recommendations: sevenSeaterResults.slice(0, 5), requiredSeats };
            }

            // Post-filter: apply family-specific rules
            let filteredResults = results;
            if (isFamily) {
                const hasCadeirinha =
                    profile.priorities?.includes('cadeirinha') || profile.priorities?.includes('crianca');
                const peopleCount = profile.people || 4;

                filteredResults = results.filter(rec => {
                    const model = rec.vehicle.model?.toLowerCase() || '';
                    const bodyType = rec.vehicle.bodyType?.toLowerCase() || '';

                    // NUNCA para família: hatch compactos/subcompactos
                    const neverForFamily = ['mobi', 'kwid', 'up!', 'uno', 'ka', 'march', 'sandero'];
                    if (neverForFamily.some(n => model.includes(n))) {
                        return false;
                    }

                    // Para família: pickups GRANDES de cabine dupla são OK (espaço similar a SUVs)
                    // Pickups COMPACTAS devem ser excluídas (cabine menor, menos conforto)
                    const isPickup =
                        bodyType.includes('pickup') ||
                        bodyType.includes('picape') ||
                        bodyType.includes('cabine');
                    if (isPickup) {
                        // Pickups grandes de cabine dupla - PERMITIDAS para família
                        const largePickups = [
                            'ranger',
                            'amarok',
                            's10',
                            'hilux',
                            'frontier',
                            'l200',
                            'triton',
                            'toro',
                        ];
                        const isLargePickup = largePickups.some(p => model.includes(p));

                        // Se for pickup compacta (Strada, Saveiro, Montana), excluir para família
                        if (!isLargePickup) {
                            return false;
                        }
                        // Pickups grandes passam no filtro (são adequadas para família)
                    }

                    // Com cadeirinha: precisa de mais espaço
                    if (hasCadeirinha) {
                        // Ideais para 2 cadeirinhas: SUVs, Sedans médios/grandes, Minivans
                        const idealForCadeirinha = [
                            // SUVs compactos bons
                            'creta',
                            'kicks',
                            't-cross',
                            'tcross',
                            'tracker',
                            'hr-v',
                            'hrv',
                            'renegade',
                            // SUVs médios (excelentes)
                            'tucson',
                            'compass',
                            'corolla cross',
                            'tiguan',
                            'sw4',
                            'trailblazer',
                            'commander',
                            // Sedans médios/grandes (muito bons)
                            'corolla',
                            'civic',
                            'cruze',
                            'sentra',
                            'jetta',
                            'virtus',
                            // Sedans compactos (aceitáveis)
                            'hb20s',
                            'onix plus',
                            'cronos',
                            'voyage',
                            'prisma',
                            // Minivans (excelentes)
                            'spin',
                            'livina',
                            'zafira',
                        ];

                        // Se é hatch, só aceita se for espaçoso
                        if (bodyType.includes('hatch')) {
                            const hatchOkForFamily = ['fit', 'golf', 'polo', 'argo'];
                            return hatchOkForFamily.some(h => model.includes(h));
                        }

                        // SUV e Sedan são sempre ok (exceto os já filtrados)
                        if (bodyType.includes('suv') || bodyType.includes('sedan')) {
                            return true;
                        }

                        // Minivan é excelente
                        if (bodyType.includes('minivan') || model.includes('spin')) {
                            return true;
                        }

                        // Verifica se está na lista ideal
                        return idealForCadeirinha.some(ideal => model.includes(ideal));
                    }

                    // Família sem cadeirinha (mais flexível)
                    // Exclui apenas os muito pequenos
                    if (bodyType.includes('hatch')) {
                        const smallHatch = ['mobi', 'kwid', 'up', 'uno', 'ka', 'march'];
                        return !smallHatch.some(s => model.includes(s));
                    }

                    return true;
                });

                // Se filtrou demais, relaxa os critérios
                if (filteredResults.length < 3 && results.length >= 3) {
                    // Tenta pegar pelo menos sedans e SUVs
                    filteredResults = results.filter(rec => {
                        const bodyType = rec.vehicle.bodyType?.toLowerCase() || '';
                        return (
                            bodyType.includes('suv') || bodyType.includes('sedan') || bodyType.includes('minivan')
                        );
                    });

                    if (filteredResults.length < 3) {
                        filteredResults = results.slice(0, 5);
                    }
                }
            }

            logger.info(
                {
                    profileKeys: Object.keys(profile),
                    resultsCount: filteredResults.length,
                    isUberBlack,
                    isUberX,
                    isFamily,
                    wantsPickup,
                },
                'Generated recommendations'
            );

            // Fallback para busca de apps de transporte: se não encontrou com filtro aptoUber,
            // tentar buscar veículos compatíveis (sedans/hatches de 2012+) sem o filtro rigoroso
            if ((isUberX || isUberBlack) && filteredResults.length === 0) {
                logger.info(
                    { isUberX, isUberBlack },
                    'App transport search found no results, trying fallback without aptoUber filter'
                );

                // Buscar veículos que seriam aptos para apps (sedan/hatch, 2012+, com ar)
                // mas que podem não ter o campo aptoUber marcado no banco
                const fallbackResults = await vehicleSearchAdapter.search('sedan hatch carro', {
                    maxPrice: query.filters.maxPrice,
                    minYear: isUberBlack ? 2018 : 2012, // Uber Black precisa ser 2018+
                    limit: 10,
                    // NÃO usar filtro aptoUber/aptoUberBlack aqui
                });

                // Filtrar manualmente por carroceria adequada
                const compatibleResults = fallbackResults.filter(rec => {
                    const bodyType = (rec.vehicle.bodyType || '').toLowerCase();
                    // Para apps: apenas sedan, hatch ou minivan
                    return (
                        bodyType.includes('sedan') ||
                        bodyType.includes('hatch') ||
                        bodyType.includes('minivan') ||
                        bodyType === ''
                    );
                });

                if (compatibleResults.length > 0) {
                    logger.info(
                        { count: compatibleResults.length },
                        'Fallback found compatible vehicles for app transport'
                    );
                    return { recommendations: compatibleResults.slice(0, 5), wantsPickup: false };
                }
            }

            return { recommendations: filteredResults.slice(0, 5), wantsPickup };
        } catch (error) {
            logger.error({ error, profile }, 'Failed to get recommendations');
            return { recommendations: [] };
        }
    }
    /**
     * Search for exact model and year match
     */
    async findExactMatch(
        model: string,
        year: number,
        queryText: string
    ): Promise<{
        exactMatch?: VehicleRecommendation;
        alternatives: VehicleRecommendation[];
        availableYears: number[];
    }> {
        // 1. Try exact search
        const exactResults = await vehicleSearchAdapter.search(
            queryText.length > 3 ? queryText : model,
            {
                limit: 5,
                model: model,
                minYear: year,
            }
        );

        // Verify if first result matches year
        const foundExact = exactResults.length > 0 && exactResults[0].vehicle.year === year;

        if (foundExact) {
            const availableYears = [...new Set(exactResults.map(r => r.vehicle.year))].sort(
                (a, b) => b - a
            );
            return {
                exactMatch: exactResults[0],
                alternatives: exactResults,
                availableYears,
            };
        }

        // 2. If no exact year match, search for model availability in any year
        const modelResults = await vehicleSearchAdapter.search(model, {
            model: model,
            limit: 20,
        });

        const availableYears = [...new Set(modelResults.map(r => r.vehicle.year))].sort(
            (a, b) => b - a
        );

        return {
            alternatives: modelResults,
            availableYears,
        };
    }

    /**
     * Check availability for specific categories (Fail Fast check)
     */
    async checkAvailability(category: 'moto' | '7seats'): Promise<boolean> {
        if (category === 'moto') {
            const results = await vehicleSearchAdapter.search('moto', {
                limit: 1,
                bodyType: 'moto',
            });
            return results.length > 0;
        }

        if (category === '7seats') {
            const results = await vehicleSearchAdapter.search('7 lugares', {
                limit: 20,
            });
            const sevenSeaters = results.filter(r => isSevenSeater(r.vehicle.model || ''));
            return sevenSeaters.length > 0;
        }

        return false;
    }
    /**
     * Process availability questions (e.g. "Do you have SUVs?")
     * Returns availability info and formatted response if available
     */
    async processAvailabilityQuestion(
        userMessage: string
    ): Promise<{
        handled: boolean;
        response?: string;
        vehicleList?: VehicleRecommendation[];
        category?: string;
    }> {
        // Check keywords
        const availabilityKeywords = [
            'tem',
            'têm',
            'disponível',
            'disponivel',
            'estoque',
            'vocês',
            'voces',
        ];
        const vehicleTypeKeywords = [
            'pickup',
            'picape',
            'suv',
            'sedan',
            'hatch',
            'caminhonete',
            'moto',
            'motocicleta',
            'scooter',
        ];
        const messageLower = userMessage.toLowerCase();

        const isAvailabilityQuestion =
            availabilityKeywords.some(kw => messageLower.includes(kw)) &&
            vehicleTypeKeywords.some(kw => messageLower.includes(kw));

        if (!isAvailabilityQuestion) {
            return { handled: false };
        }

        // Detect category
        const askedBodyType = vehicleTypeKeywords.find(kw => messageLower.includes(kw));
        const normalizedBodyType = (
            askedBodyType === 'picape' || askedBodyType === 'caminhonete'
                ? 'pickup'
                : askedBodyType === 'moto' ||
                    askedBodyType === 'motocicleta' ||
                    askedBodyType === 'scooter'
                    ? 'moto'
                    : askedBodyType
        ) as 'sedan' | 'hatch' | 'suv' | 'pickup' | 'minivan' | 'moto' | undefined;

        logger.info(
            { userMessage, askedBodyType: normalizedBodyType },
            'User asking about vehicle availability (processed by Service)'
        );

        // Search by category
        const categoryResults = await vehicleSearchAdapter.search(`${normalizedBodyType}`, {
            bodyType: normalizedBodyType,
            limit: 5,
        });

        if (categoryResults.length === 0) {
            const categoryName =
                askedBodyType === 'pickup' || askedBodyType === 'picape'
                    ? 'picapes'
                    : askedBodyType === 'moto' ||
                        askedBodyType === 'motocicleta' ||
                        askedBodyType === 'scooter'
                        ? 'motos'
                        : askedBodyType === 'suv'
                            ? 'SUVs'
                            : askedBodyType === 'sedan'
                                ? 'sedans'
                                : askedBodyType === 'hatch'
                                    ? 'hatches'
                                    : `${askedBodyType}s`;

            return {
                handled: true,
                response: `No momento não temos ${categoryName} disponíveis no estoque. 😕\n\nQuer que eu busque outras opções para você?`,
                category: normalizedBodyType,
                vehicleList: [],
            };
        }

        // Found vehicles - format response
        const categoryName =
            askedBodyType === 'pickup' || askedBodyType === 'picape'
                ? 'picapes'
                : askedBodyType === 'suv'
                    ? 'SUVs'
                    : askedBodyType === 'sedan'
                        ? 'sedans'
                        : askedBodyType === 'hatch'
                            ? 'hatches'
                            : `${askedBodyType}s`;

        const intro = `Temos ${categoryResults.length} ${categoryName} disponíveis! 🚗\n\n`;
        const vehicleListText = categoryResults
            .map((rec, i) => {
                const v = rec.vehicle;
                const emoji = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐';
                return (
                    `${emoji} ${v.brand} ${v.model} ${v.year}\n` +
                    `   💰 R$ ${v.price.toLocaleString('pt-BR')}\n` +
                    `   📍 ${v.mileage.toLocaleString('pt-BR')}km`
                );
            })
            .join('\n\n');

        const footer = '\n\n💬 Quer saber mais detalhes de algum? Me diz qual te interessou!';

        return {
            handled: true,
            response: intro + vehicleListText + footer,
            vehicleList: categoryResults,
            category: normalizedBodyType,
        };
    }
    /**
     * Process alternative year selection (e.g. user says "2018" when offered years)
     */
    async processAlternativeYear(
        userMessage: string,
        availableYears?: number[],
        searchedModel?: string
    ): Promise<{
        handled: boolean;
        recommendations?: VehicleRecommendation[];
        selectedYear?: number;
    }> {
        if (!availableYears || availableYears.length === 0) {
            return { handled: false };
        }

        const yearMatch = userMessage.match(/\b(20\d{2})\b/);
        if (!yearMatch) {
            return { handled: false };
        }

        const selectedYear = parseInt(yearMatch[1]);
        if (!availableYears.includes(selectedYear)) {
            return { handled: false };
        }

        logger.info(
            {
                selectedYear,
                searchedModel,
                availableYears,
            },
            'User selected alternative year - returning vehicle directly (processed by Service)'
        );

        // Search for the model with selected year
        const results = await vehicleSearchAdapter.search(searchedModel || '', {
            model: searchedModel,
            minYear: selectedYear,
            limit: 5,
        });

        // Filter for exact year match
        const matchingResults = results.filter(r => r.vehicle.year === selectedYear);

        if (matchingResults.length > 0) {
            return {
                handled: true,
                recommendations: matchingResults,
                selectedYear,
            };
        }

        return { handled: false };
    }
}

// Export singleton
export const vehicleRecommendationService = new VehicleRecommendationService();
