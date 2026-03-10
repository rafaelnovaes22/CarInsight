# 🚀 Quick Reference - FaciliAuto MVP

> **Guia rápido de 2 minutos para retomar o trabalho**

---

## ⚡ Status Atual

```bash
# Verificar se está rodando
ps aux | grep tsx | grep faciliauto

# Ver logs
tail -f ~/project/faciliauto-mvp/api-v2.log

# Testar API (se não responder em 10s, ignore - servidor pode estar ocupado)
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511999999999","message":"Olá"}'
```

**Servidor:** PID 7820 rodando `tsx watch src/index.ts`  
**Banco:** SQLite em `prisma/dev.db` (148 KB)  
**Versão:** v2.0 com LangGraph

---

## 🛠️ Comandos Essenciais

### **Parar servidor:**
```bash
kill 7820  # ou: lsof -ti:3000 | xargs kill -9
```

### **Iniciar servidor:**
```bash
cd ~/project/faciliauto-mvp
export PATH="$HOME/nodejs/bin:$PATH"
nohup npx tsx watch src/index.ts > server.log 2>&1 &
```

### **Ver banco de dados:**
```bash
cd ~/project/faciliauto-mvp
export PATH="$HOME/nodejs/bin:$PATH"
npx prisma studio  # Abre em http://localhost:5555
```

### **Chat interativo:**
```bash
cd ~/project/faciliauto-mvp
./chat.sh
```

---

## 📁 Arquivos Importantes

| Arquivo | Função |
|---------|--------|
| `PROJECT_STATUS_CURRENT.md` | Status verificado automaticamente |
| `PROJECT_MEMORY.md` | Memória completa do projeto (pode estar desatualizado) |
| `src/graph/nodes/` | 4 nodes do LangGraph |
| `src/services/message-handler-v2.service.ts` | Handler principal |
| `prisma/dev.db` | Banco SQLite |
| `.env` | Variáveis de ambiente |

---

## ⚠️ Problemas Conhecidos

1. **Schema Prisma:** Configurado para PostgreSQL mas usando SQLite
   - **Fix:** Mudar `provider = "sqlite"` em `prisma/schema.prisma`

2. **Timeout no curl:** Servidor pode estar ocupado processando
   - **Fix:** Verificar logs, não é crítico

3. **Datas inconsistentes:** Docs dizem jan/2025, sistema mostra nov/2025
   - **Fix:** Ignorar, não afeta funcionamento

---

## 🎯 Próximos Passos

### **Opção A: ChromaDB** (2-3h)
Busca semântica vetorial para melhores recomendações

### **Opção B: Deploy Railway** (2-3h)
WhatsApp funcionando 24/7 em produção

### **Opção C: Testes Completos** (1h)
Validar com múltiplos perfis de clientes

---

## 📞 Atalhos Rápidos

```bash
# Navegação
cd ~/project/faciliauto-mvp

# PATH Node.js
export PATH="$HOME/nodejs/bin:$PATH"

# Ver processos
ps aux | grep tsx

# Ver logs em tempo real
tail -f api-v2.log

# Reiniciar tudo
kill $(pgrep -f tsx) && nohup npx tsx watch src/index.ts > server.log 2>&1 &
```

---

**Última atualização:** 2025-11-16 12:10  
**Leia também:** PROJECT_STATUS_CURRENT.md para análise completa
