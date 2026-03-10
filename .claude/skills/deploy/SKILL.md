# Skill: Deploy Railway

Deploy do CarInsight via Git push (Railway Git integration).

## Pre-flight

```bash
# OBRIGATÓRIO antes de qualquer deploy
npm run verify:strict
```

Se falhar, corrigir antes de prosseguir. Nunca fazer deploy com código quebrado.

## Deploy Production

```bash
# Push para ambos remotes (inclui verify:strict)
npm run push:safe
```

Railway detecta o push em `main` e faz deploy automaticamente.

## Deploy Staging

```bash
git push origin develop
git push novais develop
```

Railway detecta o push em `develop` e faz deploy no serviço de staging.

## Verificação Pós-Deploy

1. Checar health: `GET /health`
2. Checar logs no Railway Dashboard
3. Testar webhook WhatsApp com mensagem de teste

## Rollback

```bash
git revert HEAD
npm run push:safe
```

## Importante

- **NUNCA** usar `railway up` ou Railway CLI — causa deploys duplicados
- Migrations rodam automaticamente no start: `resolve init → fix-migrations → migrate deploy → start:prod`
- Se migration falhar, verificar `scripts/fix-migrations.cjs`
