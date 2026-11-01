# 🧪 Suite de Testes - FaciliAuto MVP v2

> Suite completa de testes E2E (End-to-End), integração, unitários e performance usando **Vitest**

## 🎯 Estratégia de Testes: Mocks vs LLM Real

### Por que usamos Mocks?

A maioria dos testes usa **mocks** para chamadas de LLM. Isso é intencional:

| Aspecto | Testes Mockados | Testes com LLM Real |
|---------|-----------------|---------------------|
| **Propósito** | Testar lógica do código | Testar integração real |
| **Velocidade** | Milissegundos | Segundos |
| **Custo** | Grátis | API calls ($) |
| **Determinismo** | 100% previsível | Pode variar |
| **CI/CD** | ✅ Toda vez | ⚠️ Sob demanda |

### Quando usar cada tipo?

**Testes Mockados (npm test)**
- ✅ Validar lógica de parsing de respostas
- ✅ Testar fluxos de conversação
- ✅ Verificar guardrails e segurança
- ✅ Performance e latência do código

**Testes com LLM Real (npm run test:integration:llm)**
- ✅ Validar que prompts funcionam corretamente
- ✅ Testar extração de preferências em português
- ✅ Smoke tests antes de deploy
- ✅ Debugging de problemas de produção

### Comandos

```bash
# Testes rápidos (mocks) - Rodar sempre
npm test

# Testes com LLM real - Requer API keys
npm run test:integration:llm

# Smoke test rápido com LLM
npm run test:smoke
```

---

## 📊 Status Atual

| Categoria | Arquivos | Testes | Status |
|-----------|----------|--------|--------|
| **E2E** | 3 | ~60+ | ✅ Completo |
| **Agents** | 2 | ~40+ | ✅ Completo |
| **Unit** | 3 | ~30+ | ✅ Completo |
| **Integration** | 2 | ~20+ | ✅ Completo |
| **Performance** | 1 | ~15+ | ✅ Completo |
| **Total** | **11** | **~165+** | ✅ |

## 📁 Estrutura Real

```
tests/
├── e2e/                          # Testes End-to-End (fluxos completos)
│   ├── conversational-flow.e2e.test.ts   # Fluxo conversacional completo
│   ├── quiz-agent.test.ts                # Quiz flow completo
│   └── security/                         # Testes de segurança
│       └── guardrails.test.ts            # Proteção contra ataques
│
├── agents/                       # Testes de agentes individuais
│   ├── preference-extractor.test.ts      # Extração de preferências
│   └── vehicle-expert.test.ts            # Especialista em veículos
│
├── unit/                         # Testes unitários
│   ├── llm-router.test.ts                # Router de LLMs
│   ├── embedding-router.test.ts          # Router de embeddings
│   └── lib/
│       └── embeddings.test.ts            # Funções de embedding
│
├── integration/                  # Testes de integração
│   ├── basic.test.ts                     # Testes básicos
│   ├── webhook.test.ts                   # WhatsApp webhook
│   └── llm-integration.test.ts           # Testes com LLM REAL (requer API keys)
│
├── performance/                  # Testes de performance
│   └── basic-performance.test.ts         # Benchmarks básicos
│
├── helpers/                      # Utilitários de teste
│   └── test-utils.ts                     # Mocks e helpers
│
├── setup.ts                      # Configuração global
└── README.md                     # Esta documentação
```

## 🚀 Comandos

### Executar Testes

```bash
# Rodar todos os testes
npm test

# Rodar com interface UI
npm run test:ui

# Rodar apenas uma vez (CI/CD)
npm run test:run

# Rodar com coverage
npm run test:coverage

# Watch mode (desenvolvimento)
npm run test:watch
```

### Testes Específicos

```bash
# Apenas E2E
npm run test:e2e

# Apenas integração
npm run test:integration

# Apenas unitários
npm run test:unit

# Arquivo específico
npm test tests/e2e/security/guardrails.test.ts
```

## 📋 Cobertura por Categoria

### E2E Tests

#### `conversational-flow.e2e.test.ts`
- ✅ Happy Path: Discovery → Recommendation
- ✅ Extração de múltiplas preferências
- ✅ Perguntas do usuário durante conversa
- ✅ Typos e linguagem informal
- ✅ Mensagens curtas
- ✅ Variações de orçamento
- ✅ Deal breakers
- ✅ Feature flags
- ✅ Gerenciamento de estado

#### `quiz-agent.test.ts`
- ✅ Welcome message
- ✅ Budget (question 0) - múltiplos formatos
- ✅ Usage (question 1)
- ✅ People (question 2)
- ✅ Trade-in (question 3)
- ✅ Min year (question 4)
- ✅ Max KM (question 5)
- ✅ Body type (question 6)
- ✅ Urgency (question 7)
- ✅ Quiz completion
- ✅ Profile generation
- ✅ Edge cases

#### `security/guardrails.test.ts`
- ✅ Input validation
- ✅ Prompt injection (English)
- ✅ Prompt injection (Portuguese)
- ✅ System message injection
- ✅ Encoding/obfuscation attacks
- ✅ SQL injection
- ✅ Rate limiting
- ✅ Input sanitization
- ✅ Output validation
- ✅ ISO 42001 compliance

### Agent Tests

#### `preference-extractor.test.ts`
- ✅ Single field extraction
- ✅ Multiple fields extraction
- ✅ Deal breakers and constraints
- ✅ Edge cases
- ✅ Context awareness
- ✅ Profile merging
- ✅ Budget variations

#### `vehicle-expert.test.ts`
- ✅ Question detection
- ✅ Preference extraction during chat
- ✅ Conversation flow
- ✅ Readiness assessment
- ✅ Answer generation
- ✅ Recommendation formatting
- ✅ Context preservation
- ✅ Edge cases

### Unit Tests

#### `llm-router.test.ts`
- ✅ Chat completion
- ✅ Intent classification
- ✅ Provider status
- ✅ Circuit breaker
- ✅ Fallback behavior

#### `embedding-router.test.ts`
- ✅ Embedding generation
- ✅ Batch embeddings
- ✅ Cosine similarity
- ✅ Provider status
- ✅ Performance

#### `lib/embeddings.test.ts`
- ✅ Cosine similarity
- ✅ Serialization/deserialization
- ✅ Validation
- ✅ Statistics

### Integration Tests

#### `webhook.test.ts`
- ✅ GET verification
- ✅ POST message reception
- ✅ Test endpoint
- ✅ Message types (text, button, interactive)
- ✅ Error handling
- ✅ Response time

### Performance Tests

#### `basic-performance.test.ts`
- ✅ Preference extraction latency
- ✅ Quiz processing speed
- ✅ Guardrail validation speed
- ✅ Memory usage
- ✅ Concurrent operations
- ✅ Stress test
- ✅ Latency percentiles (p50, p95, p99)

## 📊 Métricas de Qualidade

### Coverage Target

```
Lines:      80%
Functions:  80%
Branches:   80%
Statements: 80%
```

Verificar coverage:
```bash
npm run test:coverage
open coverage/index.html
```

### Performance Targets

| Operação | Target | Medido |
|----------|--------|--------|
| Quiz answer processing | < 100ms | ~10ms |
| Preference extraction | < 3s | ~1-2s |
| Guardrail validation | < 5ms | ~1ms |
| Webhook response | < 5s | ~50ms |
| Profile generation | < 5ms | ~1ms |

### Latency Percentiles

| Operação | p50 | p95 | p99 |
|----------|-----|-----|-----|
| Quiz processing | ~5ms | < 100ms | < 200ms |
| Guardrail validation | < 1ms | < 5ms | < 10ms |

## 🔒 Testes de Segurança

### Guardrails - Proteção Completa

```
✅ Linguagem ofensiva
✅ Tentativas de jailbreak (DAN mode, developer mode, god mode)
✅ Prompt injection (English + Portuguese)
✅ SQL injection patterns
✅ Encoding/obfuscation attacks (base64, hex, URL encoding)
✅ System message injection ([system], system:, [assistant])
✅ Rate limiting (10 msgs/min por usuário)
✅ Output validation (leak detection)
✅ PII protection (CPF patterns)
```

## 🧩 Helpers e Utilities

### `test-utils.ts`

```typescript
import { 
  createMockConversation, 
  createMockVehicle, 
  createMockWhatsAppMessage,
  createMockEmbedding,
  cleanDatabase,
  sleep 
} from '@tests/helpers/test-utils';

// Criar conversação mock
const conversation = createMockConversation({
  state: 'QUIZ',
  currentStep: 'budget',
});

// Criar veículo mock
const vehicle = createMockVehicle({
  brand: 'Fiat',
  model: 'Argo',
  price: 48000,
});

// Criar embedding mock
const embedding = createMockEmbedding(1536);

// Limpar banco antes do teste
await cleanDatabase();
```

## 📝 Escrevendo Testes

### Template Básico

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Nome do Módulo', () => {
  beforeEach(async () => {
    // Setup
  });

  describe('Funcionalidade Específica', () => {
    it('deve fazer algo esperado', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await funcao(input);

      // Assert
      expect(result).toBe('esperado');
    });
  });
});
```

### Boas Práticas

1. **Arrange-Act-Assert**: Estruture testes em 3 partes
2. **Descrições em português**: Use `deve` nas descrições
3. **Isolamento**: Cada teste deve ser independente
4. **Cleanup**: Limpe dados antes/depois de cada teste
5. **Mocks**: Use mocks para dependências externas
6. **Timeouts**: Configure timeouts adequados (30s default)

## 🔧 Configuração

### vitest.config.mjs

```javascript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### .env.test

```env
NODE_ENV=test
DATABASE_URL=file:./test.db
GROQ_API_KEY=test-groq-key
OPENAI_API_KEY=test-openai-key
META_WEBHOOK_VERIFY_TOKEN=test_verify_token
```

## 🐛 Debugging

### VS Code

Adicione ao `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test"],
  "console": "integratedTerminal"
}
```

### CLI

```bash
# Debug específico
node --inspect-brk ./node_modules/.bin/vitest tests/e2e/security/guardrails.test.ts
```

## 📈 CI/CD

GitHub Actions em `.github/workflows/ci.yml`:

- ✅ Rodar todos os testes
- ✅ Gerar coverage
- ✅ Upload para Codecov
- ✅ Lint de código
- ✅ Build do projeto
- ✅ Deploy automático (main branch)

## 📚 Recursos

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Faker.js](https://fakerjs.dev/)
- [Supertest](https://github.com/ladjs/supertest)

---

**Última atualização**: Novembro 2025  
**Testes totais**: ~165+  
**Coverage target**: 80%+
