# 🔄 Git Workflow - Múltiplos Repositórios

## 📦 Repositórios Configurados

Este projeto está sincronizado com **2 repositórios**:

| Remote | Repositório | Uso |
|--------|-------------|-----|
| **origin** | `rafaelnovaes22/faciliauto-mvp-v2` | Desenvolvimento principal |
| **novais** | `NovAIs-Digital/renatinhus-cars` | Produção (concessionária) |

---

## 🚀 Workflow Padrão

### 1. Fazer alterações e commit

```powershell
# Verificar status
git status

# Adicionar arquivos
git add .

# Commit com mensagem descritiva
git commit -m "feat: descrição da alteração"
```

### 2. Push para ambos os repositórios

**Opção A - Push individual (Recomendado):**
```powershell
# Push para repositório principal
git push origin main

# Push para repositório de produção
git push novais main
```

**Opção B - Push para ambos de uma vez:**
```powershell
# Criar alias (executar uma vez)
git config alias.pushall '!git push origin main && git push novais main'

# Usar o alias
git pushall
```

---

## 📋 Comandos Úteis

### Verificar remotes configurados
```powershell
git remote -v
```

### Ver diferenças antes de commitar
```powershell
git diff
git diff --staged
```

### Ver histórico de commits
```powershell
git log --oneline -10
```

### Verificar branch atual
```powershell
git branch
```

### Sincronizar com repositório remoto
```powershell
# Buscar alterações sem aplicar
git fetch origin
git fetch novais

# Buscar e aplicar alterações
git pull origin main
git pull novais main
```

---

## 🔒 Segurança - Checklist Antes do Push

Antes de fazer push, **sempre verificar**:

- [ ] Arquivo `.env` **NÃO** está no commit
- [ ] Nenhuma chave de API está exposta em arquivos commitados
- [ ] Husky executou os hooks de pre-commit
- [ ] Código foi testado localmente
- [ ] Mensagem de commit é descritiva

**O Husky vai bloquear automaticamente se detectar:**
- Padrões de chaves Groq (`gsk_...`)
- Padrões de chaves Meta (`EAA...`)

---

## 🎯 Fluxo Completo de Trabalho

```powershell
# 1. Fazer alterações nos arquivos

# 2. Verificar o que mudou
git status
git diff

# 3. Adicionar arquivos
git add .

# 4. Commit (Husky vai validar automaticamente)
git commit -m "feat: descrição clara da alteração"

# 5. Push para ambos os repositórios
git push origin main
git push novais main

# 6. Verificar se foi enviado
git log --oneline -1
```

---

## 🚨 Troubleshooting

### Erro: "Authentication failed"
```powershell
# Reautenticar com GitHub
git config --global credential.helper manager
# Próximo push vai pedir autenticação
```

### Erro: "Updates were rejected"
```powershell
# Alguém fez push antes de você
# Sincronizar primeiro
git pull origin main --rebase
git push origin main
```

### Erro: "Husky blocked commit"
```powershell
# Husky detectou chaves expostas
# Verificar arquivos:
git diff --staged

# Remover chaves expostas e tentar novamente
```

### Desfazer último commit (antes do push)
```powershell
# Manter alterações
git reset --soft HEAD~1

# Descartar alterações
git reset --hard HEAD~1
```

---

## 📝 Convenções de Commit

Use prefixos semânticos nas mensagens:

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Documentação
- `refactor:` - Refatoração de código
- `test:` - Testes
- `chore:` - Tarefas de manutenção
- `style:` - Formatação de código

**Exemplos:**
```
feat: adiciona correção de URLs dos veículos
fix: corrige erro de conexão com PostgreSQL
docs: atualiza guia de setup do ambiente
refactor: melhora estrutura do seed script
```

---

## 🔄 Sincronização Entre Repositórios

Ambos os repositórios devem estar **sempre sincronizados**:

```powershell
# Verificar se estão sincronizados
git fetch origin
git fetch novais
git log origin/main..novais/main  # Deve estar vazio

# Se houver diferenças, sincronizar
git pull novais main
git push origin main
```

---

## ✅ Checklist de Push

Antes de cada push, confirme:

- [ ] `git status` está limpo (sem arquivos não rastreados importantes)
- [ ] `.env` não está no commit
- [ ] Código foi testado (`npm run dev` funciona)
- [ ] Commit tem mensagem descritiva
- [ ] Push feito para **ambos** os repositórios (origin e novais)

---

**Configuração atual:**
- ✅ Remote `origin` configurado
- ✅ Remote `novais` configurado
- ✅ Git user configurado (rafaelnovaes22)
- ✅ Husky hooks ativos

**Último commit:** `feat: adiciona correção de URLs e guias de setup`

**Status:** ✅ Sincronizado em ambos os repositórios
