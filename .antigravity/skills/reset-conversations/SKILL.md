---
name: Reset Conversations
description: Limpa conversas de teste do Inovais
---

# Skill: Reset de Conversas

## Description

Use quando o usuário pedir para:
- "Limpa as conversas de teste"
- "Reseta a conversa do número X"
- "Limpa todas as conversas"
- "Recomeça do zero"
- "Apaga o histórico de chat"

## Commands

### Reset Conversas de Teste
Reseta apenas conversas de números conhecidos de teste:
```bash
npm run conversations:reset
```

### Reset TODAS as Conversas
Remove todas as conversas do banco (cuidado!):
```bash
npm run conversations:reset:all
```

## Warning

> 🚨 **ATENÇÃO**: `conversations:reset:all` é DESTRUTIVO!
> 
> - Remove TODAS as conversas, incluindo leads reais
> - Use apenas em ambiente de desenvolvimento
> - SEMPRE confirme com o usuário antes de executar

## Smart Selection

| Usuário menciona | Comando |
|------------------|---------|
| "todas", "tudo", "all" | `npm run conversations:reset:all` (confirmar!) |
| "teste", específico | `npm run conversations:reset` |

## Quando Usar

1. **Debug de fluxo conversacional**: Reset para testar do início
2. **Após mudanças no LangGraph**: Limpar estados antigos
3. **Demonstração/Apresentação**: Começar limpo

## Informações Técnicas

O reset remove:
- Histórico de mensagens
- Estado do LangGraph (checkpoints)
- Perfil do cliente (CustomerProfile)
- Recomendações anteriores

Não remove:
- Veículos do inventário
- Leads já convertidos (se usar reset parcial)
- Configurações do sistema
