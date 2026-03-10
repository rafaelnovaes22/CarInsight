# Regras de Teste — CarInsight

## Framework

- Vitest como test runner
- Coverage target: 80%+
- CI roda: unit → integration → e2e → coverage

## Estrutura de Testes

```
tests/
├── unit/           # Lógica isolada de serviços e utilitários
├── integration/    # Interação entre componentes, webhooks, LLM
├── e2e/            # Fluxos completos de conversação
│   └── security/   # Prompt injection, rate limiting
├── agents/         # Comportamento de agentes isolados
└── repro/          # Reprodução de bugs específicos
```

## Comandos

| Comando | Uso |
|---------|-----|
| `npm test` | Vitest interativo (dev) |
| `npm run test:run` | CI mode — todos os testes |
| `npm run test:unit` | Apenas unit |
| `npm run test:integration` | Apenas integration |
| `npm run test:e2e` | End-to-end |
| `npm run test:coverage` | Com relatório de cobertura |
| `npm run test:guardrails` | Testes de segurança |

## Convenções

- Testes DB-dependent são excluídos do `test:run` (precisam de PostgreSQL)
- Mock API keys: usar `mock-key` para ativar mock mode do LLM router
- Nomes de arquivo: `nome.test.ts` ou `nome.spec.ts`
- Mocks em `__mocks__/` ou inline com `vi.mock()`
- Cada teste deve ser independente — não depender de ordem de execução

## CI/CD

- Pipeline: test → lint → build
- PostgreSQL 14 + pgvector no CI (via Docker service)
- Secrets scanning automático no lint job
- Deploy é via Railway Git integration (não há job de deploy no CI)
