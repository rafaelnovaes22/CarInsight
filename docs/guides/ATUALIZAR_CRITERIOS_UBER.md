# 🚖 Atualizar Critérios Uber (Fix Pajero)

**Problema:** Pajero (SUV) estava sendo marcada como apta para Uber  
**Causa:** Lógica antiga aceitava qualquer sedan/hatch sem verificar modelo  
**Solução:** Whitelist rigorosa de modelos permitidos

---

## ✅ O que mudou

### Antes (❌ Incorreto):
```typescript
// Aceitava QUALQUER sedan/hatch de 2012+
isUberX = ano >= 2012 && arCondicionado && portas >= 4 && 
          (carroceria.includes('sedan') || carroceria.includes('hatch'))

// Problema: Pajero tem 4 portas e ar-cond, mas é SUV!
```

### Depois (✅ Correto):
```typescript
// Verifica se modelo está na whitelist Uber
const UBER_X_MODELS = {
  honda: ['civic', 'city', 'fit'],
  toyota: ['corolla', 'etios'],
  // ... lista oficial
}

isUberX = !isNeverAllowed(carroceria) &&  // Rejeita SUV
          ano >= 2012 &&
          arCondicionado &&
          portas >= 4 &&
          isInWhitelist(marca, modelo, UBER_X_MODELS)  // Verifica whitelist
```

---

## 🚀 Como Aplicar (EXECUTAR AGORA)

### 1. Aguardar Deploy (1-2 min)
Railway vai deployar automaticamente.

### 2. Executar Update Uber

```bash
curl -X POST "https://faciliauto-mvp-v2-production.up.railway.app/admin/update-uber?secret=faciliauto2025"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Uber eligibility updated (whitelist mode)",
  "summary": {
    "totalVehicles": 57,
    "uberX": 15,  // ← Deve ser MENOS que antes
    "uberBlack": 3
  },
  "uberVehicles": [
    {
      "marca": "Honda",
      "modelo": "Civic",
      "ano": 2018,
      "uberX": true
    }
  ],
  "rejectedVehicles": [
    {
      "marca": "Mitsubishi",
      "modelo": "Pajero",
      "reason": "Not in whitelist"  // ← Pajero rejeitada!
    }
  ]
}
```

### 3. Verificar Veículos Uber

```bash
curl "https://faciliauto-mvp-v2-production.up.railway.app/admin/vehicles-uber?secret=faciliauto2025&type=x"
```

**Não deve ter:**
- ❌ Pajero
- ❌ L200
- ❌ Compass
- ❌ Tucson
- ❌ Qualquer SUV/Pickup

---

## 📊 Modelos PERMITIDOS (Whitelist)

### Uber X / 99Pop:
**Honda:** Civic, City, Fit  
**Toyota:** Corolla, Etios, Yaris  
**Chevrolet:** Onix, Prisma, Cruze, Cobalt  
**VW:** Gol, Voyage, Polo, Virtus, Jetta, Fox  
**Fiat:** Argo, Cronos, Siena, Palio, Uno, Mobi  
**Ford:** Ka, Fiesta  
**Hyundai:** HB20, HB20S, Accent, Elantra  
**Nissan:** March, Versa, Sentra  
**Renault:** Logan, Sandero, Kwid

### Uber Black:
**Honda:** Civic (premium)  
**Toyota:** Corolla (premium)  
**Chevrolet:** Cruze  
**VW:** Jetta  
**Nissan:** Sentra

---

## ❌ Tipos NUNCA Permitidos

- SUV (Pajero, Compass, Tucson, etc)
- Pickup (L200, Hilux, Ranger, etc)
- Minivan (Spin, Zafira, etc)
- Van
- 2 portas
- Sem ar-condicionado

---

## 🧪 Testar no WhatsApp

Após executar o update:

```
Você: oi
Bot: Como posso te chamar?

Você: João
Bot: Me conta: o que você está procurando?

Você: carro para uber até 60 mil
Bot: [Deve recomendar apenas modelos da whitelist]
     [NÃO deve aparecer Pajero]
```

---

## 📝 Exemplo de Conversa Corrigida

**Antes (❌ Com bug):**
```
Você: carro para uber
Bot: Encontrei:
     1. Honda Civic 2018 - R$ 65.000 ✅
     2. Pajero 2019 - R$ 58.000 ❌ (SUV!)
```

**Depois (✅ Corrigido):**
```
Você: carro para uber
Bot: Encontrei:
     1. Honda Civic 2018 - R$ 65.000 ✅
     2. Toyota Corolla 2019 - R$ 72.000 ✅
     3. Chevrolet Onix 2020 - R$ 55.000 ✅
```

---

## 🔍 Verificar se Funcionou

### 1. Listar veículos Uber X:
```bash
curl "https://sua-url.railway.app/admin/vehicles-uber?secret=faciliauto2025&type=x" | grep -i pajero
```

**Deve retornar:** (vazio) - Pajero não está na lista!

### 2. Buscar Pajero específica:
```bash
curl "https://sua-url.railway.app/stats"
```

Verificar se Pajero tem:
- `aptoUber: false` ✅
- `aptoUberBlack: false` ✅

---

## 📚 Documentação

- `CRITERIOS_UBER_ATUALIZADOS.md` - Lista completa oficial
- Ver whitelist em: `scripts/update-uber-eligibility.ts`
- Ver endpoint em: `src/routes/admin.routes.ts`

---

**Commit:** 00e485b  
**Deploy:** ⏳ Em andamento  
**Ação:** Executar POST /admin/update-uber após deploy  
**Resultado:** Pajero e outros SUVs serão corretamente rejeitados 🎯
