# Skill: Refactor

Refatorar código mantendo funcionalidade e testes passando.

## Princípios

1. **Não quebrar testes existentes** — rodar `npm run test:run` antes e depois
2. **Mudanças incrementais** — um commit por refatoração lógica
3. **Manter interfaces públicas** — mudar internals, não contratos
4. **Simplificar** — reduzir complexidade, não aumentar

## Processo

1. Ler o código atual e entender o propósito
2. Identificar oportunidades (duplicação, complexidade, naming)
3. Aplicar mudança
4. Rodar `npm run verify:strict`
5. Commit com `refactor: descrição`

## Não fazer

- Não adicionar features durante refatoração
- Não mudar formatação manualmente (Prettier cuida)
- Não renomear arquivos sem verificar todos os imports
- Não alterar migrations já aplicadas
