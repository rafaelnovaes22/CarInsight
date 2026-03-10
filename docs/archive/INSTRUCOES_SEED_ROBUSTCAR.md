# 🚗 Instruções: Atualizar Base com Veículos da Robust Car

## ✅ Arquivos Criados

1. **`scripts/robustcar-vehicles.json`** - 73 veículos extraídos do site
2. **`prisma/seed-robustcar.ts`** - Script de seed otimizado
3. **`package.json`** - Novo comando `db:seed:robustcar` adicionado

---

## 🚀 Como Executar

### 1. Popular o banco LOCAL (desenvolvimento)

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
npm run db:seed:robustcar
```

Este comando irá:
- ✅ Limpar TODOS os 28 veículos atuais da Renatinhu's Cars
- ✅ Inserir ~70 veículos da Robust Car (exceto motos e sem preço)
- ✅ Detectar automaticamente: transmissão, features, categoria
- ✅ Gerar descrições completas
- ✅ Configurar URLs para a página de detalhes

---

### 2. Gerar Embeddings OpenAI

Após popular o banco, gere os embeddings:

```bash
npm run embeddings:generate
```

Este comando irá:
- ✅ Gerar embeddings OpenAI para TODOS os veículos
- ✅ Usar modelo `text-embedding-3-small` (1536 dimensões)
- ✅ Salvar no campo `embedding` do banco
- ✅ Custo estimado: ~$0.01 para 70 veículos

---

### 3. Verificar os Dados

```bash
npm run db:studio
```

Abra o Prisma Studio e verifique:
- ✅ Total de veículos (~70)
- ✅ Categorias distribuídas (SUV, Sedan, Hatch, Pickup, Minivan)
- ✅ URLs corretas (https://robustcar.com.br/carros/...)
- ✅ Embeddings gerados (campo não nulo)

---

### 4. Testar Busca e Recomendações

```bash
npm run dev
```

Teste via WhatsApp:
- "Quero um SUV até 100 mil"
- "Quero um sedan automático"
- "Quero um hatch econômico"

---

## 📊 Distribuição Esperada

Após o seed, você terá aproximadamente:

| Categoria | Quantidade |
|-----------|------------|
| **Hatch** | ~24 | 
| **SUV** | ~20 |
| **Sedan** | ~16 |
| **Pickup** | ~2 |
| **Minivan** | ~2 |
| **TOTAL** | **~64** |

*(Motos e veículos sem preço são excluídos automaticamente)*

---

## 🔄 Deploy no Railway (Produção)

### Opção A: Via Git (Recomendado)

```bash
# 1. Commit e push
git add .
git commit -m "feat: atualizar base com veículos Robust Car (73 carros)"
git push origin main

# 2. Railway fará deploy automático

# 3. Após deploy, executar via Railway CLI:
railway run npm run db:seed:robustcar
railway run npm run embeddings:generate
```

### Opção B: Via Railway Dashboard

1. Acesse o dashboard do Railway
2. Vá em **Deployments** → **Settings**
3. Execute os comandos:
   ```bash
   npm run db:seed:robustcar
   npm run embeddings:generate
   ```

---

## ⚠️ Importante

### URLs dos Veículos

As URLs apontam para a seção **"Mais detalhes"** de cada veículo:
- ✅ Formato: `https://robustcar.com.br/carros/{marca}/{modelo}/{versao}/{slug}.html`
- ✅ Exemplo: https://robustcar.com.br/carros/Hyundai/Creta/Comfort-10-Tb-12v-Flex-Aut/Hyundai-Creta-Comfort-10-Tb-12v-Flex-Aut-2024-São-Paulo-Sao-Paulo-6907905.html

### Features Detectadas Automaticamente

O script detecta:
- **Transmissão**: Automático (se tem "AUT", "AUTOMATICO", "CVT") ou Manual
- **Ar-condicionado**: Sim (exceto versões "BASE")
- **Direção hidráulica**: Sim
- **Airbag e ABS**: Sim
- **Vidros/Travas elétricas**: Sim (exceto versões "BASE")
- **Rodas de liga leve**: Sim (se tem "LTZ", "EX", "LIMITED")

### Match Score por Categoria

O sistema já considera a categoria no Match Score:
- Cliente procura "SUV" → SUVs têm pontuação maior
- Cliente procura "sedan" → Sedans têm pontuação maior
- Cliente procura "econômico" → Hatches têm pontuação maior

---

## 🎯 Próximos Passos

Após executar o seed:

1. ✅ Testar recomendações por categoria via WhatsApp
2. ✅ Validar se URLs redirecionam corretamente
3. ✅ Ajustar Match Score se necessário
4. ✅ Atualizar preços periodicamente (scraping agendado?)

---

## 📝 Estrutura do JSON

Cada veículo em `robustcar-vehicles.json` tem:

```json
{
  "brand": "HYUNDAI",
  "model": "CRETA",
  "version": "COMFORT 1.0 TB 12V FLEX AUT.",
  "year": 2024,
  "mileage": 40353,
  "fuel": "FLEX",
  "color": "CINZA",
  "price": 98990,
  "detailUrl": "https://robustcar.com.br/carros/...",
  "category": "SUV"
}
```

---

## 🔧 Troubleshooting

### Erro: "DATABASE_URL not found"
```bash
cp .env.example .env
# Configure o DATABASE_URL no .env
```

### Erro: "Prisma client not generated"
```bash
npx prisma generate
```

### Erro: "Cannot find module 'robustcar-vehicles.json'"
Verifique se o arquivo existe em `/scripts/robustcar-vehicles.json`

---

**✅ Tudo pronto!** Execute `npm run db:seed:robustcar` para começar.
