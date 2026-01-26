---
description: Push seguro com verificações CI/CD antes de enviar ao git
---

# Push Seguro com Verificações CI/CD

Este workflow executa todas as verificações de qualidade antes de enviar código aos repositórios git.

## Comandos Disponíveis

### Push para ambos os repositórios (recomendado)
```bash
// turbo
npm run push:safe
```

### Push apenas para origin (rafaelnovaes22/CarInsight)
```bash
// turbo
npm run push:origin
```

### Push apenas para novais (NovAIs-Digital/renatinhus-cars)
```bash
// turbo
npm run push:novais
```

## O que é verificado

O script `npm run verify` executa em sequência:

1. **Prettier Format** - Formata todos os arquivos `.ts` e `.prisma`
2. **ESLint Check** - Verifica erros de linting (modo warning)
3. **Testes Unitários** - Roda todos os testes em `tests/unit/`

### Verificação Estrita (para CI/CD real)

```bash
npm run verify:strict
```

Esta versão falha se:
- Prettier encontrar arquivos não formatados
- ESLint encontrar qualquer warning
- Qualquer teste falhar

## Uso Manual

Se quiser rodar as verificações sem fazer push:

```bash
# Verificação padrão (formata automaticamente)
npm run verify

# Verificação estrita (apenas checagem)
npm run verify:strict
```

## Troubleshooting

### "Prettier check failed"
```bash
npm run format
```

### "ESLint errors"
```bash
npm run lint:fix
```

### "Tests failing"
```bash
npm run test:unit -- --reporter=verbose
```
