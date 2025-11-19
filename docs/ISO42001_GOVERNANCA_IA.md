# ISO 42001 - Governança e Gestão de IA
## FaciliAuto MVP - Sistema de Atendimento WhatsApp com IA

---

## 📋 1. VISÃO GERAL DO SISTEMA

### Propósito
Sistema de atendimento automatizado via WhatsApp para concessionária de veículos, utilizando IA generativa (LLM) para:
- Qualificar leads
- Recomendar veículos
- Responder dúvidas sobre estoque
- Transferir para atendimento humano quando necessário

### Escopo de Aplicação da IA
- **Classificação de intenções** do usuário
- **Geração de respostas** conversacionais
- **Busca semântica** em catálogo de veículos (embeddings)
- **Recomendações personalizadas** baseadas em preferências

---

## 📊 2. ORIGEM E GESTÃO DE DADOS

### 2.1 Dados Coletados

#### Dados do Usuário
| Tipo de Dado | Origem | Finalidade | Base Legal LGPD | Retenção |
|--------------|--------|------------|------------------|----------|
| Número de telefone | WhatsApp (Meta Cloud API) | Identificação e comunicação | Legítimo interesse | 90 dias após inatividade |
| Nome (quando fornecido) | Conversa com usuário | Personalização | Consentimento implícito | 90 dias após inatividade |
| Mensagens de texto | Conversa WhatsApp | Processamento de intenção | Legítimo interesse | 90 dias |
| Preferências de veículos | Declarado na conversa | Qualificação e recomendação | Consentimento implícito | 90 dias |

#### Dados do Estoque
| Tipo de Dado | Origem | Finalidade | Sensibilidade |
|--------------|--------|------------|---------------|
| Informações de veículos | Seed manual/Admin | Base de busca e recomendação | Pública (não sensível) |
| Embeddings de veículos | Gerado por Jina AI API | Busca semântica | Não sensível |

### 2.2 Licença de Uso dos Dados

✅ **PERMITIDO:**
- Processar mensagens para entender intenção do usuário
- Armazenar histórico de conversas para continuidade do atendimento
- Gerar embeddings de veículos para busca semântica
- Utilizar LLM (Groq) para geração de respostas (processamento em tempo real, sem armazenamento pelo provedor)

⚠️**REQUER ATENÇÃO:**
- Dados de conversas são enviados para API externa (Groq) - garantir conformidade com LGPD Art. 33 (transferência internacional)
- Embeddings gerados por Jina AI API (processamento externo)

❌ **NÃO PERMITIDO:**
- Uso de dados para treinamento de modelos de IA (sem consentimento explícito)
- Compartilhamento de dados pessoais com terceiros não relacionados ao serviço
- Retenção indefinida de dados de conversas

### 2.3 Conformidade com LGPD

**Controlador:** FaciliAuto (concessionária)  
**Operador:** Sistema FaciliAuto MVP  
**Subprocessadores:**
- Groq (processamento de linguagem natural)
- Jina AI (geração de embeddings)
- Meta/WhatsApp (canal de comunicação)

**Bases Legais:**
- Art. 7º, IX: Legítimo interesse (atendimento e suporte)
- Art. 7º, I: Consentimento (quando dados adicionais solicitados)

---

## ⚠️ 3. AVALIAÇÃO DE RISCOS

### 3.1 Riscos Técnicos

#### 🔴 ALTO: Alucinações da IA
**Descrição:** LLM pode inventar informações sobre veículos, preços ou condições que não existem.

**Impacto:**
- Informações incorretas sobre veículos/preços
- Promessas que não podem ser cumpridas
- Perda de confiança e reclamações

**Mitigações Implementadas:**
```typescript
// Arquivo: src/lib/groq.ts (linhas 88-100)
DIRETRIZES:
- Não invente informações sobre veículos
- Se não souber algo, seja honesto e ofereça ajuda humana
- NUNCA discuta preços sem consultar o estoque real

// Arquivo: src/services/guardrails.service.ts
- Validação de output antes de enviar ao usuário
- Detecção de vazamento de prompts do sistema
- Limitação de tamanho de resposta
```

**Controles Adicionais Recomendados:**
- [ ] Implementar fact-checking contra base de dados de veículos
- [ ] Log de todas as respostas para auditoria
- [ ] Revisão periódica de conversas por humanos

#### 🟡 MÉDIO: Injeção de Prompt
**Descrição:** Usuário malicioso tenta manipular o sistema com comandos especiais.

**Impacto:**
- Bypass de regras de negócio
- Obtenção de informações não autorizadas
- Comportamento inesperado do bot

**Mitigações Implementadas:**
```typescript
// Arquivo: src/services/guardrails.service.ts (linha 46-51)
detectPromptInjection(message) {
  // Detecta tentativas de manipulação
  // Bloqueia mensagens suspeitas
}
```

**Controles:**
- ✅ Sanitização de entrada
- ✅ Detecção de padrões maliciosos
- ✅ Rate limiting (10 msgs/min por usuário)

#### 🟡 MÉDIO: Viés e Discriminação
**Descrição:** IA pode reproduzir preconceitos em recomendações ou respostas.

**Exemplos de Risco:**
- Recomendar veículos baseado em estereótipos de gênero
- Linguagem inadequada para determinados públicos
- Viés de preço/classe social

**Mitigações Atuais:**
```typescript
// Sistema prompts enfatizam neutralidade
// Recomendações baseadas em critérios objetivos (preço, tipo, ano)
```

**Controles Recomendados:**
- [ ] Análise de viés em recomendações (auditoria trimestral)
- [ ] Testes com diversos perfis de usuários
- [ ] Feedback loop para detectar discriminação

### 3.2 Riscos de Segurança

#### 🔴 ALTO: Vazamento de Dados Pessoais
**Mitigações:**
- ✅ Validação de output para evitar leak de system prompts
- ✅ Logs não contêm dados sensíveis (apenas IDs)
- ⚠️ Dados enviados para APIs externas (Groq, Jina AI)

#### 🟡 MÉDIO: Rate Limiting e Abuso
**Mitigações:**
- ✅ Limite de 10 mensagens por minuto por usuário
- ✅ Limite de 1000 caracteres por mensagem
- ✅ Bloqueio automático de spam

---

## 🔍 4. TRANSPARÊNCIA E DISCLOSURE

### 4.1 Transparência para o Usuário

#### ❌ PROBLEMA IDENTIFICADO: Falta de Aviso de IA

**Situação Atual:**
O sistema não informa claramente ao usuário que ele está interagindo com uma IA.

**Requisitos ISO 42001 e LGPD:**
- Usuário deve saber que está conversando com um bot
- Usuário deve ser informado que a IA pode cometer erros
- Deve haver opção clara de falar com humano

**CORREÇÃO NECESSÁRIA:**

```typescript
// ADICIONAR em: src/graph/nodes/greeting.node.ts (ou equivalente)

const MENSAGEM_INICIAL = `
👋 Olá! Sou a assistente virtual da FaciliAuto.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. 
Para informações mais precisas ou dúvidas complexas, posso transferir você para nossa equipe.

Como posso ajudar você hoje?

1️⃣ Ver veículos disponíveis
2️⃣ Falar com um vendedor
3️⃣ Tirar dúvidas sobre um carro
`;
```

### 4.2 Avisos em Momentos Críticos

```typescript
// Antes de fornecer informações sobre preços
"⚠️ *Atenção:* Os valores são aproximados. Para cotação exata, confirme com nossa equipe."

// Ao recomendar veículos
"💡 Estas são sugestões baseadas no que você me contou. A decisão final deve considerar uma avaliação presencial."

// Ao detectar dúvida complexa
"🤔 Essa pergunta é importante! Vou transferir você para um especialista que pode ajudar melhor."
```

---

## 📝 5. DOCUMENTAÇÃO TÉCNICA

### 5.1 Modelos de IA Utilizados

| Componente | Modelo/Serviço | Provedor | Finalidade |
|------------|----------------|----------|------------|
| LLM Principal | llama-3.3-70b-versatile | Groq | Geração de texto, classificação |
| Embeddings | jina-embeddings-v3 | Jina AI | Busca semântica de veículos |
| Vector Store | In-Memory (PostgreSQL backup) | Local | Armazenamento de embeddings |

### 5.2 Fluxo de Dados

```
Usuário (WhatsApp)
    ↓
Meta Cloud API
    ↓
[Guardrails Input] → Validação/Sanitização
    ↓
[Conversation Graph] → Classificação de Intenção
    ↓
[Groq LLM] → Geração de Resposta
    ↓
[Guardrails Output] → Validação de Resposta
    ↓
WhatsApp → Usuário
```

### 5.3 Logs e Auditoria

**Eventos Logados:**
- ✅ Todas as interações (entrada/saída)
- ✅ Bloqueios por guardrails
- ✅ Erros de API
- ✅ Transferências para humano

**Logs Sensíveis:**
```typescript
// Arquivo: src/lib/logger.ts
// Pino logger com redação de dados sensíveis
// Não loga conteúdo completo de mensagens em produção
```

---

## ✅ 6. CHECKLIST DE CONFORMIDADE ISO 42001

### Governança

- [x] Identificação de uso de IA no sistema
- [x] Documentação de origem de dados
- [ ] **Política de retenção de dados formalizada** ⚠️
- [ ] **DPO/Encarregado de Dados designado** ⚠️

### Gestão de Riscos

- [x] Identificação de riscos de alucinação
- [x] Identificação de riscos de viés
- [x] Mitigações técnicas implementadas (guardrails)
- [ ] **Auditoria periódica de conversas** (recomendado)
- [ ] **Testes de viés trimestral** (recomendado)

### Transparência

- [ ] **❌ CRÍTICO: Aviso de IA na primeira interação** 
- [ ] **❌ Disclaimers em respostas críticas (preços, recomendações)**
- [x] Opção de transferência para humano
- [ ] **Política de privacidade acessível** ⚠️

### Segurança

- [x] Rate limiting
- [x] Validação de entrada
- [x] Validação de saída
- [x] Detecção de prompt injection
- [ ] **Criptografia de dados em repouso** (verificar DB)
- [x] HTTPS em produção (Railway)

### Direitos dos Titulares (LGPD)

- [ ] **Mecanismo de exclusão de dados (Art. 18)** ⚠️
- [ ] **Exportação de dados do usuário** ⚠️
- [ ] **Relatório de impacto de privacidade (RIPD)** (se aplicável)

---

## 🚀 7. PLANO DE AÇÃO PRIORITÁRIO

### Implementação Imediata (P0)

1. **Adicionar aviso de IA na mensagem inicial**
   - Arquivo: criar `src/config/disclosure.messages.ts`
   - Atualizar primeira interação

2. **Adicionar disclaimers em respostas críticas**
   - Preços: "Valor sujeito a confirmação"
   - Recomendações: "Sugestão baseada em IA"

3. **Criar política de privacidade simplificada**
   - Arquivo: atualizar `privacy-policy.html`
   - Link no WhatsApp

### Curto Prazo (30 dias)

4. **Implementar mecanismo de exclusão de dados**
   - Comando: "quero deletar meus dados"
   - Script de remoção LGPD-compliant

5. **Formalizar política de retenção**
   - 90 dias de inatividade → exclusão automática
   - Cron job de limpeza

6. **Auditoria de viés**
   - Analisar 100 conversas reais
   - Identificar padrões discriminatórios

### Médio Prazo (90 dias)

7. **Implementar fact-checking automatizado**
8. **Dashboard de compliance**
9. **Treinamento da equipe em governança de IA**

---

## 📞 8. CONTATOS E RESPONSABILIDADES

**Gestor do Sistema de IA:** [Nome/Setor]  
**Encarregado de Dados (DPO):** [Definir]  
**Suporte Técnico:** [Definir]

**Contato para Exercício de Direitos LGPD:**  
Email: [definir]  
Prazo de resposta: 15 dias

---

## 📅 Última Atualização
**Data:** 2025-01-27  
**Versão:** 1.0  
**Próxima Revisão:** 2025-04-27 (trimestral)
