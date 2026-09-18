# Skill: Deploy Railway

Preparação de entrega do CarInsight. Confirmar serviço, ambiente e origem efetivamente configurados no Railway.

## Pre-flight

```bash
# OBRIGATÓRIO antes de qualquer deploy
npm run verify:strict
```

Se falhar, corrigir antes de prosseguir. Nunca fazer deploy com código quebrado.

## Publicar branch para revisão

```bash
# Envia exclusivamente a branch própria para o repositório pessoal (inclui verify:strict)
npm run push:safe
```

Abrir PR sem merge. O comando bloqueia branch default e remotes fora de
`rafaelnovaes22/CarInsight`. Merge e push na default exigem autorização específica.

## Deploy autorizado

Inspecionar as configurações atuais do Railway antes de escolher integração Git ou CLI.
Não presumir staging em `develop` ou produção em `main` sem verificar o serviço.
Não disparar uma segunda publicação quando o mesmo commit já estiver sendo implantado.

## Verificação Pós-Deploy

1. Checar health: `GET /health`
2. Checar logs no Railway Dashboard
3. Testar webhook WhatsApp com mensagem de teste

## Rollback

Preparar reversão em branch própria, executar os gates e abrir PR. Uma reversão no serviço
Railway usa o deployment previamente verificado e deve respeitar a autorização da tarefa.

## Importante

- Usar somente a via de publicação verificada para o serviço, evitando deployments duplicados.
- Migrations rodam automaticamente no start: `resolve init → fix-migrations → migrate deploy → start:prod`
- Se migration falhar, verificar `scripts/fix-migrations.cjs`
