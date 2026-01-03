# Walkthrough: Fixing Missing Vehicle Recommendations

## Goal
Investigate and fix why specific budget vehicles (e.g., Celta, Palio) were not being recommended for the query:
> *"um carro não muito novo... para trabalhar diariamente"*

## Investigation Findings
1.  **Usage Extraction Issue**: The extraction agent interpreted "para trabalhar diariamente" as requiring a professional work vehicle (`usage: "trabalho"`), which filters for pickups or heavy-duty vehicles, rather than a daily commuter (`usage: "cidade"`).
2.  **Year Constraint**: The phrase "não muito novo" triggered a strict `minYear: 2012` filter, excluding older budget options like the Celta 2008 and 2011 present in the inventory.

## Changes Applied

### 1. Improved Preference Extraction (`preference-extractor.agent.ts`)
- **Refined Usage Logic**: Updated the prompt to map "dia a dia", "ir para o trabalho", and "trabalhar diariamente" to `usage: "cidade"`. Reserved `usage: "trabalho"` only for explicit heavy-duty/cargo contexts.
- **Relaxed Year Constraints**: Adjusted the "não muito velho" rule to accept vehicles from 2008 onwards (`minYear: 2008`), broadening the search pool for budget buyers.
- **Optimized Prompt**: specific optimizations were made to reduce token usage and improve latency without sacrificing accuracy.

### 2. Local CI Workflow (`scripts/ci-check.ts`)
- Created a script to automate local verification (Lint, Build, Test) to prevent regressions.

### 3. Enabled Motorcycle Recommendations (`vehicle-expert.agent.ts`)
- **Fix:** Removed hard block for motorcycles. The system now checks the inventory for motos (e.g., Yamaha Neo) before deciding whether to block or recommend.
- **Verification:** Verified with `scripts/debug-moto.ts` that "quero uma moto" now returns a budget question instead of a rejection.

## Verification Results

### Agent Logic Verification
Using the debug script, we confirmed the new extraction behavior:

**Input:** *"um carro não muito novo... para trabalhar diariamente"*
- **Before:** `usage: "trabalho"` (Blocked recommendations, asked for usage clarification)
- **After:** 
```json
{
  "usage": "cidade",
  "minYear": 2008,
  "priorities": ["economico"]
}
```

**Input:** *"quero uma moto"*
- **Before:** "No momento trabalhamos apenas com carros..."
- **After:** "Qual é o seu orçamento para a moto?" (Proceeds to recommendation)

### Search Results Verification
Simulating the full flow confirmed that appropriate vehicles are now found:
- **Celta 2008** (R$ 23.990) - *Previously excluded*
- **Fiat Idea 2010** (R$ 29.990)
- **Celta 2011** (R$ 30.990)

### CI/CD Status
- **Local CI**: ALL CHECKS PASSED (Format, Lint, Build, Tests).
- **Git**: Changes pushed to `origin/main` AND `novais/main`. GitHub Actions should be triggered automatically on both repositories.
