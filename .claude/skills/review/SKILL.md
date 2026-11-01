# Skill: Code Review

Revisar código alterado com foco em qualidade, segurança e padrões do projeto.

## Checklist de Review

1. **Segurança**: Sem secrets expostos, input sanitizado, prompt injection protegido
2. **TypeScript**: Tipos corretos, sem `any` desnecessário, Zod validation onde aplicável
3. **Testes**: Mudanças têm cobertura de teste adequada
4. **Performance**: Sem loops desnecessários, queries otimizadas, circuit breaker respeitado
5. **Convenções**: Nomenclatura kebab-case/camelCase, conventional commits
6. **LGPD**: Phone masking em logs, dados pessoais protegidos
7. **WhatsApp**: Respeita rate limits, output < 4096 chars

## Execução

```bash
# Ver mudanças
git diff --stat
git diff

# Verificar qualidade
npm run verify:strict
```

## Output

Listar problemas encontrados com severidade (critical/warning/suggestion) e arquivo:linha.
