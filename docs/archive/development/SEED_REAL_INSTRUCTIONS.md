# 🚗 Seed com Dados REAIS - Renatinhu's Cars

## 📋 O Que Foi Criado

Script de seed com os **27 veículos reais** do estoque da Renatinhu's Cars extraídos diretamente do site.

**Arquivo:** `src/scripts/seed-renatinhu-real.ts`

---

## 🎯 Características

### ✅ Dados 100% Reais

- **Marca, modelo, versão**: Exatos do site
- **Ano e quilometragem**: Reais
- **Combustível e câmbio**: Corretos
- **URL de detalhes**: Links funcionais para cada veículo
- **Fotos**: URLs das fotos reais do site

### 📸 Links Funcionais

Cada veículo tem URL no formato:
```
https://www.renatinhuscars.com.br/?id={ID}
```

**Exemplos:**
- Honda Civic 2010: `https://www.renatinhuscars.com.br/?id=682`
- Fiat Uno 2021: `https://www.renatinhuscars.com.br/?id=739`
- BMW 125I 2014: `https://www.renatinhuscars.com.br/?id=661`

### 💰 Preços Estimados

⚠️ **Importante:** Os preços foram estimados com base em valores de mercado (FIPE), pois o site mostra "Consulte".

**Você deve atualizar com valores reais da concessionária!**

---

## 🚀 Como Usar

### 1. Limpar banco e popular com dados reais

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Popular com estoque real
npm run db:seed:real
```

### 2. Gerar embeddings para busca semântica

```bash
# Gerar embeddings OpenAI para todos os veículos
npm run embeddings:generate
```

### 3. Verificar dados

```bash
# Abrir Prisma Studio
npm run db:studio
```

---

## 📊 Estoque Real Incluso (27 veículos)

### Por Marca:
- **Chevrolet**: 5 veículos (Celta, Cobalt, Corsa, Cruze, Onix)
- **Fiat**: 5 veículos (Doblo, Palio, Siena, Strada, Uno)
- **Honda**: 4 veículos (City 2013, City 2016, Civic 2012, Civic 2010)
- **Volkswagen**: 4 veículos (Fox, Fusca, Polo, T-Cross)
- **Renault**: 3 veículos (Captur, Duster, Kwid)
- **BMW**: 2 veículos (125I, X5)
- **Dodge**: 1 veículo (Journey)
- **Ford**: 1 veículo (Ka+)
- **Hyundai**: 1 veículo (Creta)
- **Land Rover**: 1 veículo (Evoque)
- **Toyota**: 1 veículo (Corolla)

### Por Carroceria:
- **Hatch**: 10 veículos
- **Sedan**: 9 veículos
- **SUV**: 6 veículos
- **Picape**: 1 veículo
- **Van**: 1 veículo

### Por Câmbio:
- **Manual**: 16 veículos
- **Automático**: 11 veículos

### Por Combustível:
- **Flex**: 20 veículos
- **Gasolina**: 6 veículos
- **Álcool**: 1 veículo

---

## 💬 Exemplo de Resposta do Bot

```
🚗 *Encontrei estes carros perfeitos para você:*

1. *Honda Civic 1.8 LXS 2010*
   📅 2010 | 🛣️ 139.562 km
   ⚙️ Automático | ⛽ Flex
   💰 R$ 42.000
   🎯 Match: 95%
   
   📸 *Ver fotos completas:*
   https://www.renatinhuscars.com.br/?id=682

2. *Chevrolet Onix 1.0 LS 2016*
   📅 2016 | 🛣️ 158.662 km
   ⚙️ Manual | ⛽ Flex
   💰 R$ 38.000
   🎯 Match: 92%
   
   📸 *Ver fotos completas:*
   https://www.renatinhuscars.com.br/?id=727

3. *Fiat Uno 1.0 Way 2021*
   📅 2021 | 🛣️ 72.406 km
   ⚙️ Manual | ⛽ Flex
   💰 R$ 48.000
   🎯 Match: 90%
   
   📸 *Ver fotos completas:*
   https://www.renatinhuscars.com.br/?id=739

📱 *Qual te interessou mais?*
```

---

## ⚠️ Ajustes Necessários

### 1. Atualizar Preços Reais

Os preços foram estimados. Você precisa:

1. Contatar a concessionária para obter preços reais
2. Atualizar o arquivo `seed-renatinhu-real.ts`
3. Rodar seed novamente

**Ou atualizar via Prisma Studio:**
```bash
npm run db:studio
# Editar manualmente cada veículo
```

### 2. Adicionar Mais Detalhes (Opcional)

Se quiser mais informações sobre cada veículo:

1. Acessar URL de cada carro
2. Extrair opcionais completos
3. Atualizar seed com dados detalhados

---

## 🔄 Migração de Dados Antigos

Se você já tinha dados no banco e quer manter alguns:

```typescript
// Antes de deletar tudo, fazer backup
const backup = await prisma.vehicle.findMany();

// Depois de popular com dados reais, adicionar dados antigos específicos
// (se necessário)
```

---

## 📈 Próximos Passos

### Imediato:
1. ✅ Rodar `npm run db:seed:real`
2. ✅ Rodar `npm run embeddings:generate`
3. ✅ Testar busca no bot

### Curto Prazo:
4. ⏳ Obter preços reais da concessionária
5. ⏳ Atualizar preços no seed
6. ⏳ Re-popular banco com valores corretos

### Médio Prazo:
7. ⏳ Adicionar mais detalhes dos veículos
8. ⏳ Sincronização automática com site
9. ⏳ Webhook para atualizar quando novo carro chegar

---

## 🎓 Vantagens dessa Abordagem

### ✅ Links Reais Funcionais
- Cliente clica e vê galeria completa
- Fotos em alta qualidade
- Todas as informações do site oficial

### ✅ Manutenção Simples
- Atualizar só o seed quando estoque mudar
- Não precisa gerenciar fotos
- Não precisa storage S3/Cloudinary

### ✅ Credibilidade
- Link oficial da concessionária
- Cliente confia mais
- Menos fricção no processo

### ✅ Zero Custo Extra
- Sem storage de imagens ($0)
- Sem processamento de fotos ($0)
- Usa infraestrutura já existente

---

## 📝 Notas Importantes

### Sobre os IDs
Os IDs (661, 682, 739, etc) são do sistema da concessionária e não mudam. São estáveis para usar como referência.

### Sobre Veículos Vendidos
Quando um veículo for vendido:
1. Marcar `disponivel: false` no banco
2. Ou deletar registro
3. Re-gerar embeddings se necessário

### Sobre Novos Veículos
Quando chegar carro novo no estoque:
1. Descobrir o ID no site
2. Adicionar ao seed
3. Rodar `npm run db:seed:real` novamente

---

## 🐛 Troubleshooting

### Erro: "Prisma client not found"
```bash
npx prisma generate
```

### Erro: "Table doesn't exist"
```bash
npx prisma db push
```

### Seed não insere veículos
```bash
# Verificar conexão com banco
npx prisma studio

# Verificar logs do seed
npm run db:seed:real
```

---

**✅ Tudo pronto para usar dados reais!** 🎉

Execute:
```bash
npm run db:seed:real && npm run embeddings:generate
```
