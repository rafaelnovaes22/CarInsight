/**
 * LangGraph Flow - Fluxo de conversa com LangGraph real
 * 
 * Estados:
 * - greeting: Saudação inicial e coleta de nome
 * - collect_info: Coleta de informações (uso, orçamento, etc)
 * - search: Busca de veículos
 * - recommend: Apresentação de recomendações
 * - followup: Acompanhamento pós-recomendação
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { vehicleSearchAdapter } from '../services/vehicle-search-adapter.service';

// ============================================
// STATE DEFINITION
// ============================================

const GraphState = Annotation.Root({
    // Identificação
    conversationId: Annotation<string>,
    phoneNumber: Annotation<string>,

    // Mensagens
    messages: Annotation<BaseMessage[]>({
        reducer: (current, update) => [...current, ...update],
        default: () => [],
    }),

    // Perfil do cliente
    customerName: Annotation<string | null>,
    budget: Annotation<number | null>,
    usage: Annotation<string | null>, // cidade, viagem, trabalho, uber, familia
    bodyType: Annotation<string | null>, // sedan, suv, hatch, pickup
    people: Annotation<number | null>,
    priorities: Annotation<string[]>({
        reducer: (current, update) => [...new Set([...current, ...update])],
        default: () => [],
    }),

    // Flags especiais
    wantsUber: Annotation<boolean>,
    uberCategory: Annotation<string | null>, // x, comfort, black
    wantsFamily: Annotation<boolean>,
    hasCadeirinha: Annotation<boolean>,
    wantsPickup: Annotation<boolean>,

    // Recomendações
    recommendations: Annotation<any[]>({
        reducer: (_, update) => update,
        default: () => [],
    }),

    // Controle de fluxo
    currentNode: Annotation<string>,
    nextNode: Annotation<string | null>,
    responseToUser: Annotation<string>,

    // Metadata
    messageCount: Annotation<number>,
    lastError: Annotation<string | null>,
});

type GraphStateType = typeof GraphState.State;

// ============================================
// LLM SETUP
// ============================================

const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    openAIApiKey: env.OPENAI_API_KEY,
});

// ============================================
// NODE: GREETING
// ============================================

async function greetingNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    logger.info({ conversationId: state.conversationId }, 'LangGraph: greeting node');

    const lastMessage = state.messages[state.messages.length - 1];
    const userText = lastMessage?.content?.toString() || '';

    // Se é primeira mensagem, dar boas-vindas e pedir nome
    if (state.messageCount <= 1) {
        return {
            currentNode: 'greeting',
            nextNode: 'collect_info',
            responseToUser: `Olá! 👋 Bem-vindo à *FaciliAuto*!

Sou seu assistente virtual e estou aqui para ajudar você a encontrar o carro usado perfeito! 🚗

Para começar, qual é o seu nome?`,
        };
    }

    // Tentar extrair nome da mensagem
    const name = await extractName(userText);

    if (name) {
        return {
            customerName: name,
            currentNode: 'greeting',
            nextNode: 'collect_info',
            responseToUser: `Prazer, ${name}! 🤝

Me conta: o que você está procurando? 

_Pode me dizer o tipo de carro, para que vai usar, e seu orçamento aproximado._`,
        };
    }

    // Não conseguiu extrair nome
    return {
        currentNode: 'greeting',
        nextNode: 'greeting',
        responseToUser: 'Desculpe, não entendi seu nome. Pode me dizer de novo? 😊',
    };
}

// ============================================
// NODE: COLLECT INFO
// ============================================

async function collectInfoNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    logger.info({ conversationId: state.conversationId }, 'LangGraph: collect_info node');

    const lastMessage = state.messages[state.messages.length - 1];
    const userText = lastMessage?.content?.toString() || '';

    // Extrair informações da mensagem
    const extracted = await extractPreferences(userText, state);

    // Merge com estado atual
    const newState: Partial<GraphStateType> = {
        ...extracted,
        currentNode: 'collect_info',
    };

    // Verificar o que temos e o que falta
    const hasBudget = extracted.budget || state.budget;
    const hasUsage = extracted.usage || state.usage;

    // Se temos informações suficientes, ir para busca
    if (hasBudget && hasUsage) {
        newState.nextNode = 'search';
        newState.responseToUser = `Perfeito! Vou buscar as melhores opções para você... 🔍`;
    }
    // Se só tem orçamento, perguntar uso
    else if (hasBudget && !hasUsage) {
        newState.nextNode = 'collect_info';
        newState.responseToUser = `Anotado! Orçamento de R$ ${hasBudget.toLocaleString('pt-BR')}.

E qual vai ser o uso principal? 
• Cidade/trabalho
• Viagens
• Aplicativo (Uber/99)
• Família`;
    }
    // Se só tem uso, perguntar orçamento
    else if (!hasBudget && hasUsage) {
        newState.nextNode = 'collect_info';
        newState.responseToUser = `Entendi! E qual seu orçamento aproximado?

_Exemplo: 50 mil, 60k, R$ 70.000_`;
    }
    // Não tem nada, perguntar tudo
    else {
        newState.nextNode = 'collect_info';
        newState.responseToUser = `Me conta mais sobre o que você busca:
• Qual o uso principal? (cidade, viagem, Uber, família)
• Qual seu orçamento aproximado?`;
    }

    return newState;
}

// ============================================
// NODE: SEARCH
// ============================================

async function searchNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    logger.info({
        conversationId: state.conversationId,
        budget: state.budget,
        usage: state.usage,
        wantsUber: state.wantsUber,
        wantsFamily: state.wantsFamily,
    }, 'LangGraph: search node');

    try {
        // Construir filtros baseados no estado
        const filters: any = {
            maxPrice: state.budget || undefined,
            limit: 10,
        };

        // Filtros de Uber
        if (state.wantsUber) {
            if (state.uberCategory === 'black') {
                filters.aptoUberBlack = true;
            } else {
                filters.aptoUber = true;
            }
        }

        // Filtros de família
        if (state.wantsFamily && !state.wantsPickup) {
            filters.aptoFamilia = true;
        }

        // Filtro de tipo de carroceria
        if (state.bodyType) {
            filters.bodyType = state.bodyType;
        }

        // Buscar veículos
        const searchQuery = buildSearchQuery(state);
        let results = await vehicleSearchAdapter.search(searchQuery, filters);

        // Pós-filtro para família com cadeirinha
        if (state.wantsFamily && state.hasCadeirinha) {
            results = filterForCadeirinha(results);
        }

        // Limitar a 5 resultados
        results = results.slice(0, 5);

        if (results.length === 0) {
            return {
                recommendations: [],
                currentNode: 'search',
                nextNode: 'collect_info',
                responseToUser: `Hmm, não encontrei veículos com esses critérios exatos. 🤔

Posso ajustar a busca:
• Aumentar um pouco o orçamento?
• Considerar outros tipos de veículo?

O que prefere?`,
            };
        }

        return {
            recommendations: results,
            currentNode: 'search',
            nextNode: 'recommend',
            responseToUser: '', // Será preenchido no recommend node
        };

    } catch (error) {
        logger.error({ error }, 'LangGraph: search error');
        return {
            lastError: 'Erro na busca',
            currentNode: 'search',
            nextNode: 'collect_info',
            responseToUser: 'Desculpe, tive um problema na busca. Pode repetir o que você procura?',
        };
    }
}

// ============================================
// NODE: RECOMMEND
// ============================================

async function recommendNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    logger.info({
        conversationId: state.conversationId,
        recommendationsCount: state.recommendations.length,
    }, 'LangGraph: recommend node');

    const recommendations = state.recommendations;

    if (recommendations.length === 0) {
        return {
            currentNode: 'recommend',
            nextNode: 'collect_info',
            responseToUser: 'Não encontrei veículos. Vamos ajustar os critérios?',
        };
    }

    // Formatar recomendações
    const intro = `🎯 Encontrei ${recommendations.length} veículo${recommendations.length > 1 ? 's' : ''} para você:\n\n`;

    const vehiclesList = recommendations.map((rec, i) => {
        const v = rec.vehicle;
        const link = v.detailsUrl || v.url || '';

        let item = `${i + 1}. ${i === 0 ? '🏆 ' : ''}*${v.brand} ${v.model} ${v.year}*
   💰 R$ ${v.price?.toLocaleString('pt-BR') || '?'}
   🛣️ ${v.mileage?.toLocaleString('pt-BR') || '?'} km
   🚗 ${v.bodyType || 'N/A'}${v.transmission ? ` | ${v.transmission}` : ''}`;

        if (link) {
            item += `\n   🔗 ${link}`;
        }

        return item;
    }).join('\n\n');

    const outro = `\n\nQual te interessou mais? Posso dar mais detalhes! 😊

_Digite "reiniciar" para nova busca ou "vendedor" para falar com nossa equipe._`;

    return {
        currentNode: 'recommend',
        nextNode: 'followup',
        responseToUser: intro + vehiclesList + outro,
    };
}

// ============================================
// NODE: FOLLOWUP
// ============================================

async function followupNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    logger.info({ conversationId: state.conversationId }, 'LangGraph: followup node');

    const lastMessage = state.messages[state.messages.length - 1];
    const userText = lastMessage?.content?.toString().toLowerCase() || '';

    // Verificar se quer mais detalhes de algum veículo
    const numberMatch = userText.match(/\b([1-5])\b/);
    if (numberMatch && state.recommendations.length > 0) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < state.recommendations.length) {
            const vehicle = state.recommendations[index].vehicle;
            return {
                currentNode: 'followup',
                nextNode: 'followup',
                responseToUser: `📋 *Detalhes do ${vehicle.brand} ${vehicle.model} ${vehicle.year}:*

💰 Preço: R$ ${vehicle.price?.toLocaleString('pt-BR')}
🛣️ KM: ${vehicle.mileage?.toLocaleString('pt-BR')} km
🚗 Tipo: ${vehicle.bodyType}
⚙️ Câmbio: ${vehicle.transmission || 'N/A'}
⛽ Combustível: ${vehicle.fuelType || 'Flex'}
🎨 Cor: ${vehicle.color || 'N/A'}

${vehicle.detailsUrl ? `🔗 Ver mais: ${vehicle.detailsUrl}` : ''}

Quer agendar uma visita ou falar com um vendedor?`,
            };
        }
    }

    // Verificar se quer vendedor
    if (userText.includes('vendedor') || userText.includes('agendar') || userText.includes('visita')) {
        return {
            currentNode: 'followup',
            nextNode: END,
            responseToUser: `Perfeito! 👨‍💼

Nossa equipe de vendas foi notificada e entrará em contato com você em breve pelo WhatsApp.

Obrigado por usar a FaciliAuto! 🚗`,
        };
    }

    // Resposta padrão
    return {
        currentNode: 'followup',
        nextNode: 'followup',
        responseToUser: `Como posso ajudar mais?

• Digite o *número* do veículo para mais detalhes
• Digite *"vendedor"* para falar com nossa equipe
• Digite *"reiniciar"* para nova busca`,
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function extractName(text: string): Promise<string | null> {
    // Padrões simples primeiro
    const patterns = [
        /(?:meu nome [ée]|me chamo|sou o?a?)\s+([A-Za-zÀ-ú]+)/i,
        /^([A-Za-zÀ-ú]{2,15})$/i, // Nome simples
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const name = match[1].trim();
            // Validar que não é uma palavra comum
            const commonWords = ['oi', 'ola', 'bom', 'boa', 'dia', 'tarde', 'noite', 'quero', 'preciso'];
            if (!commonWords.includes(name.toLowerCase())) {
                return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            }
        }
    }

    return null;
}

async function extractPreferences(text: string, state: GraphStateType): Promise<Partial<GraphStateType>> {
    const lower = text.toLowerCase();
    const result: Partial<GraphStateType> = {};

    // Extrair orçamento
    const budgetPatterns = [
        /(\d+)\s*mil/i,
        /(\d+)\s*k/i,
        /r?\$?\s*(\d{2,3})\.?(\d{3})/i,
        /(\d{4,6})/,
    ];

    for (const pattern of budgetPatterns) {
        const match = text.match(pattern);
        if (match) {
            if (pattern.source.includes('mil') || pattern.source.includes('k')) {
                result.budget = parseInt(match[1]) * 1000;
            } else if (match[2]) {
                result.budget = parseInt(match[1] + match[2]);
            } else {
                const val = parseInt(match[1]);
                result.budget = val < 1000 ? val * 1000 : val;
            }
            break;
        }
    }

    // Extrair uso
    if (lower.includes('uber') || lower.includes('99') || lower.includes('aplicativo')) {
        result.usage = 'uber';
        result.wantsUber = true;

        if (lower.includes('black')) {
            result.uberCategory = 'black';
        } else if (lower.includes('comfort')) {
            result.uberCategory = 'comfort';
        } else {
            result.uberCategory = 'x';
        }
    } else if (lower.includes('famil') || lower.includes('filho') || lower.includes('criança') || lower.includes('cadeirinha')) {
        result.usage = 'familia';
        result.wantsFamily = true;

        if (lower.includes('cadeirinha') || lower.includes('bebê') || lower.includes('criança')) {
            result.hasCadeirinha = true;
        }
    } else if (lower.includes('trabalho') || lower.includes('cidade') || lower.includes('urbano')) {
        result.usage = 'trabalho';
    } else if (lower.includes('viagem') || lower.includes('estrada') || lower.includes('viajar')) {
        result.usage = 'viagem';
    }

    // Extrair tipo de carroceria
    if (lower.includes('pickup') || lower.includes('picape') || lower.includes('caçamba')) {
        result.bodyType = 'pickup';
        result.wantsPickup = true;
    } else if (lower.includes('suv')) {
        result.bodyType = 'suv';
    } else if (lower.includes('sedan')) {
        result.bodyType = 'sedan';
    } else if (lower.includes('hatch')) {
        result.bodyType = 'hatch';
    }

    // Extrair número de pessoas
    const peopleMatch = lower.match(/(\d+)\s*pessoa/);
    if (peopleMatch) {
        result.people = parseInt(peopleMatch[1]);
    }

    return result;
}

function buildSearchQuery(state: GraphStateType): string {
    const parts: string[] = [];

    if (state.bodyType) parts.push(state.bodyType);
    if (state.usage) parts.push(state.usage);
    if (state.wantsUber) parts.push('uber aplicativo');
    if (state.wantsFamily) parts.push('familia espaçoso');
    if (state.wantsPickup) parts.push('pickup trabalho');

    return parts.join(' ') || 'carro usado';
}

function filterForCadeirinha(results: any[]): any[] {
    const neverForCadeirinha = ['mobi', 'kwid', 'up', 'uno', 'ka', 'march', 'sandero'];

    return results.filter(rec => {
        const model = rec.vehicle.model?.toLowerCase() || '';
        const bodyType = rec.vehicle.bodyType?.toLowerCase() || '';

        // Nunca para cadeirinha
        if (neverForCadeirinha.some(n => model.includes(n))) {
            return false;
        }

        // Hatch pequeno não é ideal
        if (bodyType.includes('hatch')) {
            const okHatch = ['fit', 'golf', 'polo'];
            return okHatch.some(h => model.includes(h));
        }

        return true;
    });
}

// ============================================
// ROUTER FUNCTION
// ============================================

function routeNext(state: GraphStateType): string {
    // Se tem próximo nó definido, usar ele
    if (state.nextNode) {
        if (state.nextNode === END) return END;
        return state.nextNode;
    }

    // Roteamento baseado no estado atual
    switch (state.currentNode) {
        case 'greeting':
            return state.customerName ? 'collect_info' : 'greeting';
        case 'collect_info':
            return (state.budget && state.usage) ? 'search' : 'collect_info';
        case 'search':
            return state.recommendations.length > 0 ? 'recommend' : 'collect_info';
        case 'recommend':
            return 'followup';
        case 'followup':
            return 'followup';
        default:
            return 'greeting';
    }
}

// ============================================
// BUILD GRAPH
// ============================================

export function buildConversationGraph() {
    const graph = new StateGraph(GraphState)
        .addNode('greeting', greetingNode)
        .addNode('collect_info', collectInfoNode)
        .addNode('search', searchNode)
        .addNode('recommend', recommendNode)
        .addNode('followup', followupNode)
        .addEdge(START, 'greeting')
        .addConditionalEdges('greeting', routeNext)
        .addConditionalEdges('collect_info', routeNext)
        .addConditionalEdges('search', routeNext)
        .addConditionalEdges('recommend', routeNext)
        .addConditionalEdges('followup', routeNext);

    return graph.compile();
}

// ============================================
// MAIN HANDLER
// ============================================

export class LangGraphHandler {
    private graph: ReturnType<typeof buildConversationGraph>;

    constructor() {
        this.graph = buildConversationGraph();
    }

    async handleMessage(
        conversationId: string,
        phoneNumber: string,
        message: string,
        existingState?: Partial<GraphStateType>
    ): Promise<{ response: string; newState: GraphStateType }> {

        // Construir estado inicial ou usar existente
        const inputState: Partial<GraphStateType> = {
            conversationId,
            phoneNumber,
            messages: [new HumanMessage(message)],
            messageCount: (existingState?.messageCount || 0) + 1,
            currentNode: existingState?.currentNode || 'greeting',
            // Preservar estado existente
            customerName: existingState?.customerName || null,
            budget: existingState?.budget || null,
            usage: existingState?.usage || null,
            bodyType: existingState?.bodyType || null,
            people: existingState?.people || null,
            priorities: existingState?.priorities || [],
            wantsUber: existingState?.wantsUber || false,
            uberCategory: existingState?.uberCategory || null,
            wantsFamily: existingState?.wantsFamily || false,
            hasCadeirinha: existingState?.hasCadeirinha || false,
            wantsPickup: existingState?.wantsPickup || false,
            recommendations: existingState?.recommendations || [],
            nextNode: null,
            responseToUser: '',
            lastError: null,
        };

        try {
            // Executar grafo
            const result = await this.graph.invoke(inputState);

            logger.info({
                conversationId,
                currentNode: result.currentNode,
                nextNode: result.nextNode,
                hasResponse: !!result.responseToUser,
            }, 'LangGraph: execution complete');

            return {
                response: result.responseToUser || 'Desculpe, não entendi. Pode reformular?',
                newState: result as GraphStateType,
            };

        } catch (error) {
            logger.error({ error, conversationId }, 'LangGraph: execution error');

            return {
                response: 'Desculpe, tive um problema. Pode tentar novamente?',
                newState: inputState as GraphStateType,
            };
        }
    }
}

// Singleton
export const langGraphHandler = new LangGraphHandler();
