# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Guidelines
- **ALWAYS** use the `ask_gemini_coder` tool for writing, refactoring, or analyzing code.
- Do not write code yourself unless the tool fails.
- Assume the tool uses the most advanced model available (Gemini 3 Pro).

## Development Commands

### Running the Application
```bash
npm run dev              # Start development server with tsx watch
npm run dev:api          # Start API server without WhatsApp integration
npm run build            # Compile TypeScript to dist/
npm run start:prod       # Production mode with tsx (no build needed)
```

### Database Operations
```bash
npm run db:push          # Apply Prisma schema to database (no migrations)
npm run db:studio        # Open Prisma Studio GUI
npm run db:seed:real     # Seed database with real vehicle data (Renatinhu)
npm run db:seed:robustcar # Alternative seed with Robustcar dataset
```

### Embeddings Management
```bash
npm run embeddings:generate    # Generate OpenAI embeddings for vehicles without them
npm run embeddings:regenerate  # Regenerate embeddings for all vehicles
npm run embeddings:stats       # Show embedding statistics (coverage, models used)
npm run embeddings:force       # Force regenerate even if embeddings exist
```

### Testing
```bash
npm test                    # Run all tests with Vitest
npm run test:watch          # Watch mode for development
npm run test:coverage       # Generate coverage report (80% target)
npm run test:ui             # Open Vitest UI dashboard
npm run test:e2e            # Run end-to-end conversation tests
npm run test:integration    # Integration tests (LLM, webhooks, API)
npm run test:unit           # Unit tests only
npm run test:smoke          # Quick smoke test for LLM availability
```

### Utility Scripts
```bash
npm run conversations:reset       # Reset test conversations (by phone number)
npm run conversations:reset:all   # Reset ALL conversations (use with caution)
npm run vehicles:update-uber      # Update Uber eligibility flags using LLM
npm run benchmark:llms            # Compare performance of OpenAI vs Groq
npm run lint                      # Run ESLint with --max-warnings 0
npm run lint:fix                  # Auto-fix linting issues
npm run format                    # Format code with Prettier
npm run format:check              # Check formatting without modifying
```

## Architecture Overview

### Multi-LLM Routing System

The codebase implements a sophisticated **fallback chain with circuit breaker** for both LLM completion and embeddings:

**LLM Providers (src/lib/llm-router.ts):**
1. OpenAI GPT-4o-mini (primary) - Requires `OPENAI_API_KEY`
2. Groq LLaMA 3.1 8B Instant (fallback) - Requires `GROQ_API_KEY`
3. Mock mode (last resort) - Pattern-based responses for development

**Embedding Providers (src/lib/embedding-router.ts):**
1. OpenAI text-embedding-3-small (1536 dim) - Primary
2. Cohere embed-multilingual-v3.0 (1024→1536 dim) - Fallback with auto-normalization
3. Mock embeddings - Random normalized vectors for development

**Circuit Breaker Pattern:**
- 3 consecutive failures open circuit for 60 seconds
- Automatic retry with exponential backoff (2 retries per provider)
- Provider health status tracked in memory
- Debug endpoint: `/debug/llm-status`

### State Machine Architecture (LangGraph)

The conversation flow is orchestrated by **LangGraph** (NOT a custom state machine):

**Core Files:**
- `src/graph/workflow.ts` - Main StateGraph definition with nodes and edges
- `src/types/graph.types.ts` - IGraphState interface (messages, profile, recommendations, metadata)
- `src/graph/checkpointer/prisma-checkpointer.ts` - Persistence layer

**Graph Nodes (src/graph/nodes/):**
1. `greeting.node.ts` - Initial contact, name extraction, AI disclosure (ISO 42001)
2. `discovery.node.ts` - Conversational discovery of customer needs
3. `search.node.ts` - Vector/SQL hybrid search execution
4. `recommendation.node.ts` - Present top 3 vehicles with reasoning
5. `financing.node.ts` - Financing simulation and options
6. `trade_in.node.ts` - Trade-in vehicle evaluation
7. `negotiation.node.ts` - Handoff to human sales team

**State Transitions:**
- Nodes return `Partial<IGraphState>` with `state.next` to route to next node
- Routing function (`routeNode`) maps state.next → node name or END
- Checkpointing saves full state to PostgreSQL after each node
- Resumable conversations persist for days/weeks

### Agent System

**Multi-agent orchestration** with specialized responsibilities:

| Agent | File | Primary Responsibility |
|-------|------|------------------------|
| VehicleExpertAgent | `src/agents/vehicle-expert.agent.ts` | Main conversation orchestrator (71KB) |
| OrchestratorAgent | `src/agents/orchestrator.agent.ts` | Intent classification (QUALIFICAR/HUMANO/DUVIDA) |
| RecommendationAgent | `src/agents/recommendation.agent.ts` | Hybrid LLM + vector search, exact model detection |
| PreferenceExtractorAgent | `src/agents/preference-extractor.agent.ts` | Extract structured profile from unstructured text |
| FinancingAgent | `src/agents/financing.agent.ts` | Financing simulation, down payment extraction |
| TradeInAgent | `src/agents/trade-in.agent.ts` | Trade-in vehicle evaluation |

**Agents interact via:**
- LangChain message abstractions (HumanMessage, AIMessage, SystemMessage)
- Shared IGraphState passed between nodes
- LLM Router for all AI calls (automatic fallback)
- Guardrails service for input/output validation

### Guardrails Service (Security Layer)

**File:** `src/services/guardrails.service.ts`

**Input Validation:**
- Rate limiting: 10 messages/minute per user (in-memory)
- Message length: max 1000 chars
- **Prompt injection detection:** 40+ regex patterns including:
  - System prompt manipulation (PT-BR and English)
  - Role manipulation (`you are now`, `ignore previous`)
  - Jailbreak attempts (DAN mode, god mode, developer mode)
  - Encoding obfuscation (base64, unicode escape)
  - SQL injection patterns
- Special character flooding: rejects 30%+ special chars
- Repeated character flooding: rejects 10+ consecutive identical chars

**Output Validation:**
- Length check: max 4096 chars (WhatsApp limit)
- System prompt leak detection: 11 patterns for internal instruction exposure
- Inappropriate content filtering: violence, illegal activity, CPF leaks
- ISO 42001 compliance: auto-adds AI disclaimers

**Important:** Guardrails uses singleton pattern with auto-cleanup every 60 seconds.

### Vector Search Architecture

**Hybrid search strategy** combining semantic and SQL:

1. **In-Memory Vector Store** (`src/services/in-memory-vector.service.ts`)
   - Loads all vehicle embeddings into memory on startup
   - Non-blocking initialization (does NOT block server start)
   - Cosine similarity search < 50ms
   - Falls back to SQL if embeddings unavailable

2. **Vehicle Search Adapter** (`src/services/vehicle-search-adapter.service.ts`)
   - Orchestrates vector search + business logic filters
   - Pre-filters by budget, year, km, body type
   - LLM evaluation for context matching (Uber, family, etc.)

3. **Exact Search Service** (`src/services/exact-search.service.ts`)
   - Handles specific model+year requests ("Civic 2020")
   - Year alternatives if exact match not found
   - Feature flag: `exact-vehicle-search` in RecommendationAgent

### Prisma Database Schema

**Key Models:**
- `Vehicle` - Inventory with embeddings (JSON string 1536 dim), flags (aptoUber, aptoFamilia)
- `Conversation` - State persistence, quiz answers, current step
- `Recommendation` - Top 3 vehicles with matchScore (0-100) and LLM reasoning
- `Lead` - Qualified leads for CRM integration
- `AuditLog` - ISO 42001 compliance tracking

**Important:** This project uses `prisma db push` (NOT migrations). Schema changes are applied directly.

## Critical Architecture Patterns

### 1. Incremental Profile Building
Customer profiles are built incrementally across conversation turns:
- Each node can update `state.profile` with new extractions
- PreferenceExtractorAgent uses confidence scoring
- Recommendations work even with incomplete profiles

### 2. Feature Flags
Located in `src/lib/feature-flags.ts`:
- `ENABLE_CONVERSATIONAL_MODE` - Toggle between VehicleExpertAgent (natural language) vs QuizAgent (structured)
- `CONVERSATIONAL_ROLLOUT_PERCENTAGE` - Gradual rollout (0-100)
- `exact-vehicle-search` - Feature flag in RecommendationAgent code

### 3. Metadata-Driven State
Conversation metadata tracks user interactions:
- `visit_requested` - Prevents duplicate scheduling messages
- `handoff_requested` - Prevents duplicate human handoff
- `viewed_vehicle_1/2/3` - Tracks which vehicles user asked about
- `loopCount`, `errorCount` - Safety limits for infinite loops

### 4. Brazilian Market Specifics
- **LGPD compliance:** `src/services/data-rights.service.ts` for data deletion/export
- **Uber driver detection:** Strict rules (2023+ year, sedan/hatch, 4+ seats, manual transmission)
- **Portuguese language:** All prompts, guardrails, and classification in PT-BR
- **WhatsApp integration:** Meta Cloud API (official) with Baileys fallback

### 5. Cost Optimization
- LLM router tracks token usage per provider
- Groq (LLaMA 3.1) is 3x cheaper than OpenAI for fallback ($0.05 vs $0.15)
- Embeddings persisted in database (not regenerated per search)
- Mock mode for development (no API costs)

## Testing Strategy

**Coverage target:** 80% (lines, functions, branches, statements)

**Test Categories:**
- `tests/e2e/` - Full conversation flows (greeting → recommendation)
- `tests/integration/` - LLM integration, webhooks, Meta API
- `tests/unit/` - LLM router, embedding router, guardrails
- `tests/agents/` - Individual agent behavior

**Test Configuration:**
- Uses Vitest with globals enabled
- Path aliases: `@/` → `src/`, `@tests/` → `tests/`
- 30 second timeout for LLM calls
- Setup file: `tests/setup.ts`

**Run single test file:**
```bash
npx vitest run tests/unit/llm-router.test.ts
```

## Environment Setup

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - Primary LLM + embeddings (can work without if Groq configured)
- `META_WHATSAPP_TOKEN` - Meta Cloud API access token
- `META_WHATSAPP_PHONE_NUMBER_ID` - WhatsApp Business phone number ID
- `META_WEBHOOK_VERIFY_TOKEN` - Webhook verification token

**Optional (Fallback Providers):**
- `GROQ_API_KEY` - LLM fallback (LLaMA 3.1 8B Instant)
- `COHERE_API_KEY` - Embedding fallback (multilingual)

**See `.env.example` for complete list with detailed comments.**

## Common Development Workflows

### Adding a New Agent
1. Create agent file in `src/agents/` following existing pattern
2. Implement methods using LLM router (`llmRouter.chat()`)
3. Add agent to appropriate graph node in `src/graph/nodes/`
4. Create tests in `tests/agents/`
5. Update types in `src/types/` if needed

### Adding a New Graph Node
1. Create node file in `src/graph/nodes/`
2. Define async function signature: `(state: IGraphState) => Promise<Partial<IGraphState>>`
3. Set `state.next` to route to next node
4. Add node to workflow in `src/graph/workflow.ts`
5. Update routing logic in `routeNode()` function
6. Test state transitions in `tests/e2e/`

### Modifying Guardrails
1. Edit patterns in `src/services/guardrails.service.ts`
2. Add test cases in `tests/unit/guardrails.test.ts`
3. Test with `npm run test:guardrails` script
4. Monitor `AuditLog` table for detection effectiveness

### Updating LLM Prompts
1. Prompts are defined in each agent file (system messages)
2. Use structured output when possible (Zod schemas)
3. Test with `npm run benchmark:llms` to compare providers
4. Consider fallback behavior (Groq has different capabilities than OpenAI)

## Important Notes

- **No TypeScript strict mode:** `strict: false` in tsconfig.json (legacy codebase)
- **CommonJS modules:** Uses `module: "commonjs"` NOT ES modules
- **Runtime:** Uses `tsx` for development (NOT ts-node) for faster startup
- **Checkpointing:** Conversations persist in database, not in-memory
- **WhatsApp limits:** Messages max 4096 chars, enforced by guardrails
- **Circuit breaker state:** In-memory only (resets on server restart)
- **Rate limiting:** In-memory only (use Redis in production)

## Debugging

**LLM Status:**
```bash
curl http://localhost:3000/debug/llm-status
```

**Conversation State:**
```bash
npm run db:studio  # Browse conversations in Prisma Studio
```

**Logs:**
- Uses Pino structured logging (`src/lib/logger.ts`)
- Logs include: conversation_id, phone_number, event, metadata
- Production: logs to stdout (Railway/Heroku capture)

**Common Issues:**
- **Embeddings not working:** Run `npm run embeddings:generate` after seeding
- **LLM always using mock:** Check API keys in `.env` file
- **Circuit breaker stuck:** Restart server or wait 60 seconds
- **Tests timing out:** Increase timeout in vitest.config.mjs or check API keys

## Coding Guidelines (Critical Reminder)
- **ALWAYS** use the `ask_gemini_coder` tool for writing, refactoring, or analyzing code.
- Do not write code yourself unless the tool fails.
- Assume the tool uses the most advanced model available (Gemini 3 Pro).
