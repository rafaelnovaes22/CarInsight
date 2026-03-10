# Regras de Código — CarInsight

## Formatação & Linting

- Prettier para formatação automática (config em `.prettierrc`)
- ESLint strict — zero warnings permitidos
- Husky pre-commit: format + lint automáticos
- Encoding: UTF-8 sem BOM (nunca CP-1252)

## Nomenclatura

- **Arquivos**: kebab-case (`vehicle-search.service.ts`)
- **Variáveis/funções**: camelCase (`matchScore`, `calculatePrice()`)
- **Classes**: PascalCase (`OrchestratorAgent`, `VehicleService`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Tipos/Interfaces**: PascalCase (`ConversationState`, `VehicleFilter`)

## TypeScript

- Strict mode habilitado
- Zod para runtime validation (especialmente env vars e inputs externos)
- Tipos explícitos em interfaces públicas
- Evitar `any` — usar `unknown` quando necessário

## Padrões de Serviço

- Um serviço por arquivo, nomeado como `nome.service.ts`
- Agentes em `src/agents/`, nodes em `src/graph/nodes/`
- Configuração centralizada em `src/config/env.ts`
- Logger: Pino structured JSON com `maskPhoneNumber` para LGPD

## Segurança

- Nunca commitar secrets (`.env`, API keys)
- Rate limiting em endpoints públicos
- Sanitização de input (guardrails.service.ts)
- Output validation (limite 4096 chars para WhatsApp)
- Prompt injection detection ativo

## Resiliência

- LLM routing com circuit breaker: OpenAI → Groq → Mock
- Embedding routing: OpenAI → Cohere → Mock
- Fallback em camadas para busca: ano → marca → categoria → preço
- Migrations SQL idempotentes: `IF NOT EXISTS` / `DO $$ ... $$`

## Git

- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `style:`
- SEMPRE rodar `npm run verify:strict` antes de commit
- Push para ambos remotes: `origin` e `novais`
