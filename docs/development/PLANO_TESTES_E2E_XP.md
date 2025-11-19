# 🧪 Plano de Testes E2E com Metodologia XP - FaciliAuto MVP

**Data:** 2025-11-17  
**Versão:** 1.0  
**Projeto:** faciliauto-mvp-v2

---

## 📋 Índice

1. [Análise da Estrutura Atual](#análise-da-estrutura-atual)
2. [Metodologia XP Aplicada](#metodologia-xp-aplicada)
3. [Arquitetura de Testes E2E](#arquitetura-de-testes-e2e)
4. [Stack de Testes Recomendada](#stack-de-testes-recomendada)
5. [Implementação](#implementação)
6. [Plano de Ação](#plano-de-ação)

---

## 1. Análise da Estrutura Atual

### ✅ Testes Existentes

#### Testes Unitários/Integração
```
src/test-bot.ts              - Teste simulado de conversa completa
src/test-guardrails.ts       - 35 casos de teste de segurança
src/test-meta.ts             - Teste de integração Meta Cloud API
src/test-system.ts           - Diagnóstico completo do sistema
test-complete.ts             - Fluxo end-to-end com Groq
test-vector-search.ts        - Validação de busca vetorial
```

#### Scripts npm Existentes
```json
{
  "test:bot": "tsx src/test-bot.ts",
  "test:guardrails": "tsx src/test-guardrails.ts"
}
```

### ⚠️ Gaps Identificados

1. **Sem framework de testes** - Não usa Jest/Vitest/Mocha
2. **Sem assertions estruturadas** - Console.log manual
3. **Sem coverage report** - Impossível medir cobertura
4. **Sem CI/CD integration** - Testes não rodam automaticamente
5. **Sem mocks/stubs estruturados** - Dependências reais em testes
6. **Sem testes de performance** - Latência não medida
7. **Sem testes de carga** - Capacidade desconhecida
8. **Sem relatórios padronizados** - Dificuldade de rastreamento

---

## 2. Metodologia XP Aplicada

### 🎯 Princípios XP para Testes

#### 1. **Test-Driven Development (TDD)**
```
RED → GREEN → REFACTOR
```
- Escrever teste ANTES do código
- Teste falha inicialmente (RED)
- Implementar código mínimo para passar (GREEN)
- Refatorar mantendo testes verdes (REFACTOR)

#### 2. **Continuous Integration**
- Testes rodam a cada commit
- Build quebrado = prioridade máxima
- Feedback em < 10 minutos

#### 3. **Collective Code Ownership**
- Qualquer dev pode rodar/modificar testes
- Testes são documentação viva
- Padrões claros e consistentes

#### 4. **Simple Design**
- Testes simples e legíveis
- Um conceito por teste
- Nomes descritivos (Given-When-Then)

#### 5. **Pair Programming**
- Driver: escreve teste
- Navigator: pensa em edge cases
- Alternância de papéis

#### 6. **Small Releases**
- Deploy frequente de features testadas
- Testes E2E garantem integridade
- Rollback rápido se necessário

---

## 3. Arquitetura de Testes E2E

### 📐 Estrutura Proposta

```
faciliauto-mvp-v2/
├── tests/
│   ├── e2e/                          # Testes End-to-End
│   │   ├── flows/                    # Fluxos completos de usuário
│   │   │   ├── happy-path.e2e.test.ts
│   │   │   ├── quiz-complete.e2e.test.ts
│   │   │   ├── recommendation.e2e.test.ts
│   │   │   ├── error-handling.e2e.test.ts
│   │   │   └── edge-cases.e2e.test.ts
│   │   ├── agents/                   # Testes de agentes
│   │   │   ├── orchestrator.e2e.test.ts
│   │   │   ├── quiz-agent.e2e.test.ts
│   │   │   └── recommendation-agent.e2e.test.ts
│   │   ├── integrations/             # Integrações externas
│   │   │   ├── groq-api.e2e.test.ts
│   │   │   ├── meta-api.e2e.test.ts
│   │   │   ├── database.e2e.test.ts
│   │   │   └── embeddings.e2e.test.ts
│   │   └── security/                 # Testes de segurança
│   │       ├── guardrails.e2e.test.ts
│   │       ├── rate-limiting.e2e.test.ts
│   │       └── input-validation.e2e.test.ts
│   │
│   ├── integration/                  # Testes de Integração
│   │   ├── services/
│   │   │   ├── message-handler.integration.test.ts
│   │   │   ├── vector-search.integration.test.ts
│   │   │   └── whatsapp-meta.integration.test.ts
│   │   └── database/
│   │       ├── prisma-queries.integration.test.ts
│   │       └── transactions.integration.test.ts
│   │
│   ├── unit/                         # Testes Unitários
│   │   ├── agents/
│   │   │   ├── orchestrator.unit.test.ts
│   │   │   ├── quiz.unit.test.ts
│   │   │   └── recommendation.unit.test.ts
│   │   ├── services/
│   │   │   ├── guardrails.unit.test.ts
│   │   │   └── in-memory-vector.unit.test.ts
│   │   └── lib/
│   │       ├── groq.unit.test.ts
│   │       └── logger.unit.test.ts
│   │
│   ├── performance/                  # Testes de Performance
│   │   ├── load-test.perf.test.ts
│   │   ├── stress-test.perf.test.ts
│   │   └── latency.perf.test.ts
│   │
│   ├── fixtures/                     # Dados de teste
│   │   ├── conversations.json
│   │   ├── vehicles.json
│   │   └── quiz-answers.json
│   │
│   ├── mocks/                        # Mocks reutilizáveis
│   │   ├── groq-mock.ts
│   │   ├── meta-api-mock.ts
│   │   └── prisma-mock.ts
│   │
│   ├── helpers/                      # Helpers de teste
│   │   ├── test-client.ts            # Cliente HTTP de teste
│   │   ├── database-cleaner.ts       # Limpar DB entre testes
│   │   ├── factory.ts                # Factory de dados
│   │   └── assertions.ts             # Custom matchers
│   │
│   └── config/
│       ├── jest.config.ts            # Configuração Jest
│       ├── setup.ts                  # Setup global
│       └── teardown.ts               # Teardown global
│
└── .github/workflows/
    └── ci.yml                        # Pipeline CI/CD
```

---

## 4. Stack de Testes Recomendada

### 🛠️ Ferramentas

#### Framework de Testes
```bash
# Opção 1: Jest (mais popular, ecossistema rico)
npm install -D jest @types/jest ts-jest

# Opção 2: Vitest (mais rápido, nativo ESM)
npm install -D vitest @vitest/ui
```

**Recomendação:** **Vitest** 
- ⚡ 10-20x mais rápido que Jest
- 🔄 Watch mode inteligente
- 🎯 API compatível com Jest
- 📊 UI Dashboard nativo
- 🚀 Native TypeScript support

#### Assertions & Mocking
```bash
npm install -D @vitest/expect      # Matchers avançados
npm install -D sinon               # Mocks/Stubs/Spies
npm install -D nock                # HTTP mocking
```

#### E2E Testing
```bash
npm install -D supertest           # HTTP assertions
npm install -D @faker-js/faker     # Geração de dados fake
```

#### Coverage
```bash
npm install -D @vitest/coverage-v8  # Coverage reports
```

#### Performance Testing
```bash
npm install -D autocannon          # Load testing
npm install -D clinic              # Profiling
```

#### CI/CD
```bash
npm install -D husky               # Git hooks (já instalado)
npm install -D lint-staged         # Pre-commit linting (já instalado)
```

---

## 5. Implementação

### 📝 Exemplo: Teste E2E Happy Path

```typescript
// tests/e2e/flows/happy-path.e2e.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageHandler } from '../../../src/services/message-handler.service';
import { prisma } from '../../../src/lib/prisma';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/database-cleaner';

describe('E2E: Happy Path - Cliente compra carro', () => {
  let handler: MessageHandler;
  const testPhone = '5511999887766';

  beforeEach(async () => {
    await setupTestDatabase();
    handler = new MessageHandler();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('deve completar fluxo de qualificação e gerar recomendações', async () => {
    // GIVEN: Cliente novo inicia conversa
    const greeting = await handler.handleMessage(testPhone, 'Olá, quero comprar um carro');
    
    expect(greeting).toContain('Bem-vindo');
    expect(greeting).toContain('LGPD');
    
    // WHEN: Cliente consente e inicia quiz
    const consentimento = await handler.handleMessage(testPhone, 'sim');
    
    expect(consentimento).toContain('Qual é o seu orçamento');
    
    // AND: Responde todas as perguntas do quiz
    const respostas = [
      { input: '50000', expectation: 'principal uso' },
      { input: 'trabalho', expectation: 'pessoas' },
      { input: '4', expectation: 'itens essenciais' },
      { input: 'ar condicionado', expectation: 'ano mínimo' },
      { input: '2018', expectation: 'quilometragem' },
      { input: '80000', expectation: 'tipo de carroceria' },
      { input: 'sedan', expectation: 'marca preferida' },
      { input: 'qualquer', expectation: 'Encontrei' },
    ];

    for (const { input, expectation } of respostas) {
      const response = await handler.handleMessage(testPhone, input);
      expect(response).toContain(expectation);
    }

    // THEN: Deve retornar 3-5 recomendações com Match Score
    const ultimaResposta = await handler.handleMessage(testPhone, 'qualquer');
    
    expect(ultimaResposta).toContain('🎯 Encontrei');
    expect(ultimaResposta).toMatch(/Match:\s+\d+%/);
    expect(ultimaResposta).toContain('R$');
    
    // AND: Deve salvar no banco de dados
    const conversation = await prisma.conversation.findUnique({
      where: { userId: testPhone },
      include: { messages: true, leads: true },
    });

    expect(conversation).toBeDefined();
    expect(conversation?.messages.length).toBeGreaterThan(8);
    expect(conversation?.leads.length).toBeGreaterThan(0);
  });

  it('deve lidar com respostas inválidas graciosamente', async () => {
    // GIVEN: Cliente inicia quiz
    await handler.handleMessage(testPhone, 'Olá');
    await handler.handleMessage(testPhone, 'sim');
    
    // WHEN: Fornece orçamento inválido
    const response = await handler.handleMessage(testPhone, 'banana');
    
    // THEN: Deve pedir para tentar novamente
    expect(response).toMatch(/valor válido|número|orçamento/i);
    expect(response).not.toContain('erro');
  });

  it('deve respeitar rate limiting', async () => {
    // GIVEN: Cliente envia múltiplas mensagens rapidamente
    const promises = Array(15).fill(null).map(() => 
      handler.handleMessage(testPhone, 'teste')
    );
    
    // WHEN: Todas são processadas
    const responses = await Promise.all(promises);
    
    // THEN: Algumas devem ser bloqueadas por rate limit
    const blocked = responses.filter(r => r.includes('muitas mensagens'));
    expect(blocked.length).toBeGreaterThan(0);
  });
});
```

### 📝 Exemplo: Teste de Integração Groq

```typescript
// tests/integration/groq-api.integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { chatCompletion, extractIntent } from '../../../src/lib/groq';

describe('Integration: Groq API', () => {
  it('deve classificar intenção de compra corretamente', async () => {
    const mensagens = [
      'quero comprar um carro',
      'estou procurando um veículo',
      'tem carros disponíveis?',
    ];

    for (const msg of mensagens) {
      const intent = await extractIntent(msg);
      expect(intent).toBe('purchase_intent');
    }
  });

  it('deve gerar recomendações em português fluente', async () => {
    const response = await chatCompletion([
      { role: 'user', content: 'Por que esse carro é bom para mim?' }
    ]);

    expect(response).toMatch(/[áéíóúãõâêô]/); // Contém acentos portugueses
    expect(response.length).toBeGreaterThan(50);
  });

  it('deve respeitar timeout de 10 segundos', async () => {
    const start = Date.now();
    
    await chatCompletion([
      { role: 'user', content: 'teste' }
    ]);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000);
  });
});
```

### 📝 Exemplo: Teste de Performance

```typescript
// tests/performance/latency.perf.test.ts
import { describe, it, expect } from 'vitest';
import { MessageHandler } from '../../../src/services/message-handler.service';

describe('Performance: Latência de resposta', () => {
  it('deve responder quiz em < 2 segundos', async () => {
    const handler = new MessageHandler();
    const testPhone = '5511999000001';

    const start = Date.now();
    await handler.handleMessage(testPhone, 'Olá');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);
  });

  it('deve gerar recomendações em < 5 segundos', async () => {
    const handler = new MessageHandler();
    const testPhone = '5511999000002';

    // Setup: responder quiz
    await handler.handleMessage(testPhone, 'Olá');
    await handler.handleMessage(testPhone, 'sim');
    
    const respostas = ['50000', 'trabalho', '4', 'ar', '2018', '80000', 'sedan', 'qualquer'];
    for (const r of respostas.slice(0, -1)) {
      await handler.handleMessage(testPhone, r);
    }

    // Measure
    const start = Date.now();
    await handler.handleMessage(testPhone, respostas[respostas.length - 1]);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });
});
```

---

## 6. Plano de Ação

### 🎯 Fase 1: Setup (2-3 dias)

#### Sprint 1: Configuração Inicial
- [ ] Instalar Vitest e dependências
- [ ] Criar estrutura de pastas `/tests`
- [ ] Configurar `vitest.config.ts`
- [ ] Migrar `test-guardrails.ts` para Vitest
- [ ] Criar helpers básicos (database-cleaner, factory)

**Entrega:** Suite básica funcionando com 1 teste E2E

#### Sprint 2: Mocks e Fixtures
- [ ] Criar mocks para Groq API
- [ ] Criar mocks para Meta Cloud API
- [ ] Criar fixtures de veículos e conversas
- [ ] Implementar Prisma mock para testes unitários

**Entrega:** Testes rodam sem dependências externas

---

### 🎯 Fase 2: Testes E2E (1 semana)

#### Sprint 3: Happy Paths
- [ ] Fluxo completo de qualificação
- [ ] Geração de recomendações
- [ ] Envio de proposta
- [ ] Persistência no banco

**Entrega:** 4 testes E2E de happy path

#### Sprint 4: Edge Cases
- [ ] Respostas inválidas no quiz
- [ ] Timeout de APIs externas
- [ ] Banco de dados indisponível
- [ ] Rate limiting acionado
- [ ] Usuário abandona conversa

**Entrega:** 5 testes E2E de edge cases

#### Sprint 5: Segurança
- [ ] Guardrails completos (35 casos)
- [ ] Input validation
- [ ] SQL injection
- [ ] Prompt injection
- [ ] XSS/HTML injection

**Entrega:** 35+ testes de segurança

---

### 🎯 Fase 3: CI/CD (2-3 dias)

#### Sprint 6: GitHub Actions
- [ ] Criar workflow `.github/workflows/ci.yml`
- [ ] Rodar testes em cada PR
- [ ] Bloquear merge se testes falharem
- [ ] Gerar relatório de coverage
- [ ] Notificar falhas no Slack/Discord

**Entrega:** Pipeline CI/CD funcionando

#### Sprint 7: Pre-commit Hooks
- [ ] Rodar testes unitários antes de commit
- [ ] Rodar linter e formatter
- [ ] Validar mensagens de commit
- [ ] Bloquear commit se testes falharem

**Entrega:** Git hooks configurados

---

### 🎯 Fase 4: Otimização (3-5 dias)

#### Sprint 8: Performance Testing
- [ ] Load test com autocannon (1k req/min)
- [ ] Stress test (limite de ruptura)
- [ ] Memory leak detection
- [ ] Latência P50/P95/P99
- [ ] Benchmarks de embeddings

**Entrega:** Relatório de performance

#### Sprint 9: Coverage > 80%
- [ ] Identificar código não coberto
- [ ] Escrever testes faltantes
- [ ] Refatorar código não testável
- [ ] Atingir 80%+ coverage

**Entrega:** Coverage report > 80%

---

## 📊 Métricas de Sucesso

### KPIs de Qualidade

| Métrica | Objetivo | Atual | Status |
|---------|----------|-------|--------|
| Coverage | > 80% | ? | 🔴 Medir |
| Testes E2E | > 20 | ~5 | 🟡 Expandir |
| Testes Unitários | > 50 | 0 | 🔴 Criar |
| Tempo CI | < 5 min | N/A | 🔴 Implementar |
| Taxa de falha | < 5% | ? | 🔴 Monitorar |

### SLAs de Performance

| Operação | SLA | P95 | Status |
|----------|-----|-----|--------|
| Resposta quiz | < 2s | ? | 🔴 Medir |
| Recomendações | < 5s | ? | 🔴 Medir |
| Vector search | < 500ms | ? | 🔴 Medir |
| Groq API call | < 1s | ? | 🔴 Medir |

---

## 🔧 Configuração Inicial

### 1. Instalar Dependências

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Framework de testes
npm install -D vitest @vitest/ui @vitest/coverage-v8

# Mocking & Assertions
npm install -D @faker-js/faker
npm install -D supertest @types/supertest

# Performance
npm install -D autocannon

# Git hooks (já instalado)
# npm install -D husky lint-staged
```

### 2. Configurar Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/config/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 30000, // 30s para testes E2E
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
```

### 3. Adicionar Scripts npm

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run tests/e2e",
    "test:integration": "vitest run tests/integration",
    "test:unit": "vitest run tests/unit",
    "test:perf": "vitest run tests/performance",
    "test:watch": "vitest watch"
  }
}
```

### 4. Criar GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: faciliauto_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Prisma migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/faciliauto_test

      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/faciliauto_test
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          NODE_ENV: test

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
```

---

## 🎓 Boas Práticas XP

### 1. Test Naming Convention (Given-When-Then)

```typescript
// ✅ BOM
it('deve retornar erro quando orçamento for negativo', () => {});

// ❌ RUIM
it('teste de orçamento', () => {});
```

### 2. Arrange-Act-Assert (AAA)

```typescript
it('deve calcular match score corretamente', () => {
  // Arrange (Given)
  const vehicle = createVehicle({ price: 50000 });
  const criteria = { budget: 55000 };
  
  // Act (When)
  const score = calculateMatchScore(vehicle, criteria);
  
  // Assert (Then)
  expect(score).toBeGreaterThan(80);
});
```

### 3. Test Independence

```typescript
// ✅ BOM - Cada teste limpa seu próprio state
beforeEach(async () => {
  await cleanupTestDatabase();
});

// ❌ RUIM - Testes dependem da ordem de execução
```

### 4. Test Data Builders

```typescript
// tests/helpers/factory.ts
export class VehicleFactory {
  static create(overrides = {}) {
    return {
      marca: 'Fiat',
      modelo: 'Argo',
      ano: 2023,
      preco: 50000,
      ...overrides,
    };
  }
}

// Uso
const vehicle = VehicleFactory.create({ preco: 60000 });
```

---

## 📚 Recursos Adicionais

### Documentação
- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [XP Testing Principles](http://www.extremeprogramming.org/rules/unittests.html)

### Tools
- [Vitest UI](https://vitest.dev/guide/ui.html) - Dashboard visual
- [Codecov](https://codecov.io/) - Coverage reporting
- [Autocannon](https://github.com/mcollina/autocannon) - Load testing

---

## ✅ Checklist de Implementação

### Sprint 1 (Setup)
- [ ] Instalar Vitest + dependências
- [ ] Criar estrutura `/tests`
- [ ] Configurar `vitest.config.ts`
- [ ] Criar helper de database cleaning
- [ ] Migrar 1 teste existente

### Sprint 2 (Mocks)
- [ ] Mock Groq API
- [ ] Mock Meta Cloud API
- [ ] Fixtures de veículos
- [ ] Factory de dados
- [ ] Prisma mock

### Sprint 3 (E2E Happy Path)
- [ ] Fluxo de qualificação completo
- [ ] Geração de recomendações
- [ ] Persistência no banco
- [ ] 4+ testes E2E

### Sprint 4 (E2E Edge Cases)
- [ ] Respostas inválidas
- [ ] Timeouts
- [ ] Rate limiting
- [ ] 5+ testes de edge cases

### Sprint 5 (Segurança)
- [ ] Migrar test-guardrails.ts
- [ ] Adicionar casos de SQL injection
- [ ] Adicionar casos de XSS
- [ ] 35+ testes de segurança

### Sprint 6 (CI/CD)
- [ ] GitHub Actions workflow
- [ ] Coverage reporting
- [ ] Bloquear merge com falhas
- [ ] Notificações

### Sprint 7 (Pre-commit)
- [ ] Husky hooks
- [ ] Rodar testes unitários
- [ ] Lint + format
- [ ] Validação de commit

### Sprint 8 (Performance)
- [ ] Load tests
- [ ] Stress tests
- [ ] Memory profiling
- [ ] Latency benchmarks

### Sprint 9 (Coverage)
- [ ] Medir coverage atual
- [ ] Identificar gaps
- [ ] Escrever testes faltantes
- [ ] Atingir 80%+

---

## 🚀 Próximos Passos Imediatos

1. **Decidir**: Vitest ou Jest?
   - Recomendação: **Vitest** (mais rápido, moderno)

2. **Instalar dependências**:
   ```bash
   npm install -D vitest @vitest/ui @vitest/coverage-v8 @faker-js/faker supertest
   ```

3. **Criar estrutura mínima**:
   ```bash
   mkdir -p tests/{e2e,integration,unit,helpers,mocks,fixtures,config}
   ```

4. **Migrar primeiro teste**:
   - Converter `src/test-guardrails.ts` → `tests/e2e/security/guardrails.e2e.test.ts`

5. **Validar setup**:
   ```bash
   npm run test
   ```

---

**Documento criado por:** Assistente IA  
**Data:** 2025-11-17  
**Versão:** 1.0  
**Status:** ✅ PRONTO PARA IMPLEMENTAÇÃO
