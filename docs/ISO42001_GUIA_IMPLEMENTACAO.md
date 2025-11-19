# Guia de Implementação - ISO 42001 Compliance

## 🎯 Objetivo
Implementar as correções críticas de conformidade ISO 42001 identificadas no sistema FaciliAuto MVP.

---

## ⚠️ AÇÕES CRÍTICAS (Implementar IMEDIATAMENTE)

### 1. Atualizar Mensagem Inicial com Aviso de IA

**Arquivo:** `src/graph/nodes/` (localizar node de saudação inicial)

**Antes:**
```typescript
"Olá! Como posso ajudar?"
```

**Depois:**
```typescript
import { DISCLOSURE_MESSAGES } from '../../config/disclosure.messages';

// Na função de saudação inicial:
return DISCLOSURE_MESSAGES.INITIAL_GREETING;
```

**Resultado esperado:**
```
👋 Olá! Sou a assistente virtual da *FaciliAuto*.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros...
```

---

### 2. Adicionar Disclaimers Automáticos em Respostas

**Arquivo:** `src/services/guardrails.service.ts`

**Localizar:** Método `validateOutput(output: string)`

**Adicionar após linha 96:**
```typescript
import { autoAddDisclaimers } from '../config/disclosure.messages';

validateOutput(output: string): GuardrailResult {
  // ... código existente ...
  
  // NOVO: Adicionar disclaimers automáticos
  const outputWithDisclaimers = autoAddDisclaimers(output);
  
  return {
    allowed: true,
    sanitizedInput: outputWithDisclaimers, // Usar versão com disclaimers
  };
}
```

---

### 3. Implementar Comando de Exclusão de Dados (LGPD)

**Criar arquivo:** `src/services/data-rights.service.ts`

```typescript
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export class DataRightsService {
  /**
   * Exclui todos os dados de um usuário (direito ao esquecimento - LGPD Art. 18)
   */
  async deleteUserData(phoneNumber: string): Promise<boolean> {
    try {
      logger.info({ phoneNumber }, 'LGPD: Solicitação de exclusão de dados');

      await prisma.$transaction([
        // Deletar mensagens
        prisma.message.deleteMany({ where: { phoneNumber } }),
        
        // Deletar recomendações
        prisma.recommendation.deleteMany({ where: { phoneNumber } }),
        
        // Deletar lead
        prisma.lead.deleteMany({ where: { phoneNumber } }),
        
        // Deletar conversas
        prisma.conversation.deleteMany({ where: { phoneNumber } }),
      ]);

      logger.info({ phoneNumber }, 'LGPD: Dados excluídos com sucesso');
      return true;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'LGPD: Erro ao excluir dados');
      return false;
    }
  }

  /**
   * Exporta dados de um usuário (portabilidade - LGPD Art. 18)
   */
  async exportUserData(phoneNumber: string): Promise<any> {
    try {
      const [conversation, messages, lead, recommendations] = await Promise.all([
        prisma.conversation.findFirst({ where: { phoneNumber } }),
        prisma.message.findMany({ where: { phoneNumber }, orderBy: { createdAt: 'asc' } }),
        prisma.lead.findFirst({ where: { phoneNumber } }),
        prisma.recommendation.findMany({ 
          where: { phoneNumber },
          include: { vehicle: true }
        }),
      ]);

      return {
        solicitacao: new Date().toISOString(),
        telefone: phoneNumber,
        conversa: conversation,
        mensagens: messages,
        lead: lead,
        recomendacoes: recommendations,
      };
    } catch (error) {
      logger.error({ error, phoneNumber }, 'LGPD: Erro ao exportar dados');
      throw error;
    }
  }
}

export const dataRightsService = new DataRightsService();
```

---

### 4. Integrar Comandos LGPD no Handler de Mensagens

**Arquivo:** `src/services/message-handler-v2.service.ts` (ou equivalente)

**Adicionar verificação de comandos especiais:**

```typescript
import { dataRightsService } from './data-rights.service';
import { DISCLOSURE_MESSAGES } from '../config/disclosure.messages';

// No início do método handleMessage:
async handleMessage(phoneNumber: string, message: string) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Comando de exclusão de dados
  if (lowerMessage.includes('deletar meus dados') || 
      lowerMessage.includes('excluir meus dados') ||
      lowerMessage.includes('remover meus dados')) {
    
    const confirmMessage = '⚠️ Tem certeza que deseja excluir todos os seus dados? Digite *SIM* para confirmar.';
    // Salvar estado de confirmação pendente
    return confirmMessage;
  }
  
  // Confirmação de exclusão
  if (lowerMessage === 'sim' && /* verificar se há confirmação pendente */) {
    const success = await dataRightsService.deleteUserData(phoneNumber);
    
    if (success) {
      return '✅ Seus dados foram excluídos com sucesso. Obrigado por usar a FaciliAuto!';
    } else {
      return '❌ Erro ao excluir dados. Por favor, contate nosso suporte.';
    }
  }
  
  // Comando de exportação
  if (lowerMessage.includes('exportar meus dados')) {
    const data = await dataRightsService.exportUserData(phoneNumber);
    // Enviar como arquivo JSON via WhatsApp ou email
    return '✅ Seus dados estão sendo preparados e serão enviados por email em breve.';
  }
  
  // ... resto do código existente ...
}
```

---

### 5. Atualizar Política de Privacidade

**Arquivo:** `privacy-policy.html`

**Adicionar seções:**

```html
<h2>5. Uso de Inteligência Artificial</h2>
<p>
  Nosso sistema utiliza inteligência artificial (IA) para atendimento automatizado via WhatsApp.
</p>
<ul>
  <li><strong>Transparência:</strong> Você será informado quando estiver conversando com nossa IA.</li>
  <li><strong>Limitações:</strong> A IA pode cometer erros. Sempre confirme informações críticas com nossa equipe.</li>
  <li><strong>Processamento:</strong> Suas mensagens são processadas por serviços de terceiros (Groq, Jina AI) para análise e geração de respostas.</li>
  <li><strong>Transferência:</strong> Você pode solicitar atendimento humano a qualquer momento.</li>
</ul>

<h2>6. Seus Direitos (LGPD)</h2>
<ul>
  <li><strong>Acesso:</strong> Solicitar cópia dos seus dados</li>
  <li><strong>Exclusão:</strong> Solicitar exclusão dos seus dados (digite "quero deletar meus dados" no chat)</li>
  <li><strong>Portabilidade:</strong> Exportar seus dados em formato estruturado</li>
  <li><strong>Revogação:</strong> Deixar de receber mensagens a qualquer momento</li>
</ul>

<h2>7. Retenção de Dados</h2>
<p>
  Armazenamos suas conversas por até 90 dias após a última interação. 
  Após esse período, seus dados são automaticamente excluídos.
</p>

<h2>8. Contato - Encarregado de Dados</h2>
<p>
  Para exercer seus direitos ou tirar dúvidas sobre privacidade:<br>
  <strong>Email:</strong> privacidade@faciliauto.com.br<br>
  <strong>Prazo de resposta:</strong> 15 dias úteis
</p>
```

---

## 🔧 IMPLEMENTAÇÃO PASSO A PASSO

### Passo 1: Importar configurações
```bash
# Nenhuma instalação necessária, usamos código já criado
```

### Passo 2: Identificar pontos de integração
```bash
# Localizar arquivo de saudação inicial
grep -r "Olá" src/graph/nodes/ --include="*.ts"

# Localizar handler principal de mensagens
ls src/services/message-handler*.ts
```

### Passo 3: Aplicar mudanças
1. Atualizar mensagem inicial (item 1)
2. Adicionar disclaimers automáticos (item 2)
3. Criar service de direitos de dados (item 3)
4. Integrar comandos LGPD (item 4)
5. Atualizar política de privacidade (item 5)

### Passo 4: Testar
```bash
# Teste 1: Verificar mensagem inicial
npm run dev
# Enviar mensagem e verificar aviso de IA

# Teste 2: Comandos LGPD
# Enviar: "quero deletar meus dados"
# Verificar resposta de confirmação

# Teste 3: Disclaimers
# Perguntar sobre preço
# Verificar se resposta tem "⚠️ Valores sujeitos a confirmação"
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Mensagem inicial inclui aviso de IA ✅
- [ ] Disclaimers aparecem em respostas sobre preços
- [ ] Disclaimers aparecem em recomendações
- [ ] Comando "deletar meus dados" funciona
- [ ] Comando requer confirmação
- [ ] Política de privacidade atualizada
- [ ] Link da política acessível no chat
- [ ] Logs registram operações LGPD

---

## 📊 MONITORAMENTO CONTÍNUO

### Métricas para Dashboards

```typescript
// Adicionar ao endpoint /stats
{
  compliance: {
    dataDeleteRequests: await prisma.dataRightRequest.count({ where: { type: 'DELETE' }}),
    averageResponseTime: '...',
    aiTransparencyRate: '100%', // % de conversas que receberam aviso
  }
}
```

### Auditoria Mensal
- [ ] Revisar 50 conversas aleatórias
- [ ] Verificar qualidade das respostas
- [ ] Identificar padrões de erro ou viés
- [ ] Documentar incidentes

---

## 🚨 ALERTAS CRÍTICOS

Configure alertas para:

1. **Alta taxa de transferência para humano** (>30%)
   - Pode indicar baixa qualidade da IA

2. **Solicitações de exclusão de dados** (>5/dia)
   - Investigar problemas de privacidade

3. **Mensagens bloqueadas por guardrails** (>10/dia)
   - Verificar se há falsos positivos

4. **Respostas muito longas** (>500 chars)
   - IA pode estar "divagando"

---

## 📞 PRÓXIMOS PASSOS

### Curto Prazo (7 dias)
- Implementar itens 1-5 acima
- Testar em ambiente de homologação
- Deploy em produção

### Médio Prazo (30 dias)
- Implementar cron job de limpeza (90 dias)
- Criar dashboard de compliance
- Treinar equipe em comandos LGPD

### Longo Prazo (90 dias)
- Auditoria externa de conformidade
- Certificação ISO 42001 (opcional)
- Implementar fact-checking automático

---

## 📚 REFERÊNCIAS

- ISO/IEC 42001:2023 - Information technology — Artificial intelligence — Management system
- LGPD (Lei 13.709/2018) - Arts. 7º, 18, 33
- Guia de Boas Práticas ANPD para IA (em consulta pública)

---

**Documentação criada em:** 2025-01-27  
**Responsável técnico:** [Definir]  
**Próxima revisão:** 2025-02-27
