# ⚡ EXECUTAR MIGRAÇÃO ROBUST CAR - GUIA RÁPIDO

**Status:** ✅ TUDO PRONTO - BASTA EXECUTAR

---

## 🚀 Comandos (na ordem)

### 1. Popular o banco com 70 veículos

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
npm run db:seed:robustcar
```

**Resultado esperado:**
```
✅ 1. RENAULT KWID ZEN 2 2025 - R$ 62.990
✅ 2. FIAT MOBI TREKKING 1.0 MT 2025 - R$ 75.990
...
✅ 70. (último veículo)

📊 Resumo:
   ✅ Inseridos: 70
   ⏭️  Pulados: 3
   📦 Total: 73

🚗 Veículos por categoria:
   Hatchback: 24
   SUV: 20
   Sedan: 16
   Picape: 2
   Minivan: 2

✅ Seed concluído com sucesso!
```

---

### 2. Gerar embeddings OpenAI

```bash
npm run embeddings:generate
```

**Resultado esperado:**
```
🔄 Gerando embeddings para 70 veículos...
✅ 1/70 - RENAULT KWID
✅ 2/70 - FIAT MOBI
...
✅ 70/70 - ÚLTIMO VEÍCULO

✅ Embeddings gerados com sucesso!
Custo estimado: $0.01
```

---

### 3. Verificar no Prisma Studio

```bash
npm run db:studio
```

Acessar: http://localhost:5555

**Verificar:**
- [ ] Total de 70 veículos
- [ ] Campo `url` preenchido com URLs Robust Car
- [ ] Campo `embedding` não-nulo
- [ ] Categorias: SUV, Sedan, Hatchback, Picape, Minivan

---

### 4. Testar localmente

```bash
npm run dev
```

**Via WhatsApp (número de teste):**

Enviar mensagens:
1. "Oi" → Iniciar quiz
2. Responder quiz completo
3. "Quero um SUV até 120 mil"
4. Verificar se retorna: CRETA, DUSTER, TRACKER
5. Clicar em "Mais detalhes" e validar URL

---

### 5. Deploy no Railway (PRODUÇÃO)

```bash
# Commit e push
git add .
git commit -m "feat: migrar para 70 veículos Robust Car"
git push origin main

# Aguardar deploy automático (1-2 min)

# Executar seed na produção
railway run npm run db:seed:robustcar

# Gerar embeddings na produção
railway run npm run embeddings:generate
```

---

### 6. Testar em PRODUÇÃO

Via WhatsApp do número real aprovado pela Meta:

1. Fazer quiz completo
2. Testar diferentes categorias:
   - "Quero um SUV" → SUVs no topo
   - "Quero um sedan" → Sedans no topo
   - "Quero um carro econômico" → Hatches no topo
3. Clicar em "Mais detalhes" → Deve abrir https://robustcar.com.br

---

## 🎯 O QUE MUDOU

### Antes (Renatinhu's Cars)
- 28 veículos
- Site: https://renatinhuscars.com.br
- Faixa: R$ 20k - 150k

### Depois (Robust Car)
- **70 veículos** (2.5x mais)
- Site: https://robustcar.com.br
- Faixa: R$ 14k - 270k
- **5 categorias** bem definidas
- **40% automáticos**

---

## ⚠️ IMPORTANTE

### URLs dos Veículos

✅ As URLs apontam para a página de detalhes de cada veículo na Robust Car.

**Exemplo:**
```
https://robustcar.com.br/carros/Hyundai/Creta/Comfort-10-Tb-12v-Flex-Aut/Hyundai-Creta-Comfort-10-Tb-Flex-12v-Aut-2024-São-Paulo-Sao-Paulo-6907905.html
```

Cliente clica → É levado para o site oficial → Vê fotos, detalhes, contato da loja.

---

### Veículos Excluídos Automaticamente

O seed **EXCLUI**:
- ✅ Motos (1 veículo)
- ✅ Veículos sem preço (2 veículos)

**Total inserido:** 70 de 73

---

## 🧪 Testes Sugeridos

Após executar, testar:

| Teste | Mensagem | Esperado |
|-------|----------|----------|
| 1 | "Quero um SUV até 120 mil" | CRETA, DUSTER, TRACKER |
| 2 | "Quero um sedan até 90 mil" | HB20S, CRUZE, CITY |
| 3 | "Quero um hatch até 70 mil" | ONIX, KWID, MOBI |
| 4 | "Quero um carro para viagem" | Sedans/SUVs ranqueados mais alto |
| 5 | "Quero um carro para cidade" | Hatches ranqueados mais alto |

---

## 📚 Documentação Completa

Se precisar de mais detalhes:

1. **`INSTRUCOES_SEED_ROBUSTCAR.md`** - Instruções detalhadas
2. **`MELHORIAS_MATCH_SCORE_CATEGORIAS.md`** - Como melhorar Match Score
3. **`RESUMO_MIGRACAO_ROBUSTCAR.md`** - Resumo executivo completo

---

## ❓ Troubleshooting

### Erro: "npm: command not found"
```bash
# Verificar instalação do Node.js
node --version
npm --version
```

### Erro: "Cannot find module 'robustcar-vehicles.json'"
```bash
# Verificar se arquivo existe
ls -la scripts/robustcar-vehicles.json
```

### Erro: "DATABASE_URL not found"
```bash
# Verificar .env
cat .env | grep DATABASE_URL
```

### Erro: "Prisma client not generated"
```bash
npx prisma generate
```

---

## ✅ PRONTO!

**Próximo comando:**

```bash
npm run db:seed:robustcar
```

🚀 **Boa sorte com a migração!**
