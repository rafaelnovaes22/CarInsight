# 🎯 Melhorias no Match Score por Categoria

## ✅ Status Atual

O sistema **JÁ considera categorias** no Match Score:

### Lógica Existente (linha 126-157)

```typescript
// Body type (10% weight)
if (bodyType && bodyType !== 'tanto faz') {
  if (vehicle.carroceria.toLowerCase().includes(bodyType.toLowerCase())) {
    score += 10;  // ✅ Match perfeito
  } else {
    score -= 15;  // ❌ Penalidade por não ser o tipo desejado
  }
}

// Usage-based category bonus
if (usage === 'cidade' && vehicle.carroceria.includes('hatch')) {
  score += 10;  // Hatch é ótimo para cidade
}
if (usage === 'viagem' && (carroceria.includes('sedan') || carroceria.includes('suv'))) {
  score += 10;  // Sedan/SUV é ótimo para viagem
}
if (usage === 'trabalho' && vehicle.carroceria.includes('picape')) {
  score += 15;  // Picape é essencial para trabalho
}
```

---

## 🚀 Melhorias Propostas

### 1. Aumentar Peso da Categoria (de 10% para 20%)

**Problema:** Cliente que pede "SUV" ainda pode receber Hatches com score alto.

**Solução:** Aumentar bonificação de match e penalidade:

```typescript
// Body type (20% weight) - AUMENTADO
if (bodyType && bodyType !== 'tanto faz') {
  if (vehicle.carroceria.toLowerCase().includes(bodyType.toLowerCase())) {
    score += 20;  // 🆙 Dobrou a bonificação
  } else {
    score -= 25;  // 🆙 Aumentou penalidade
  }
}
```

---

### 2. Mapear Categorias do Seed para Match Score

**Problema:** O seed usa categorias (`SUV`, `SEDAN`, `HATCH`, `PICKUP`) mas o schema usa `carroceria` diferente.

**Mapeamento Atual no Seed:**
```typescript
'SUV' → 'SUV'
'SEDAN' → 'Sedan'
'HATCH' → 'Hatchback'
'PICKUP' → 'Picape'
'MINIVAN' → 'Minivan'
```

**Ajuste Necessário:**
O Match Score já busca por `.includes()`, então funciona! Mas podemos melhorar:

```typescript
// Normalizar categorias no Match Score
const normalizeBodyType = (carroceria: string): string => {
  const map: Record<string, string> = {
    'hatchback': 'hatch',
    'sedan': 'sedan',
    'suv': 'suv',
    'picape': 'pickup',
    'minivan': 'minivan'
  };
  return map[carroceria.toLowerCase()] || carroceria.toLowerCase();
};
```

---

### 3. Adicionar Bonus por Subcategorias

**Exemplo:** Cliente quer "SUV compacto" vs "SUV grande"

```typescript
// SUV subcategories
if (bodyType === 'suv') {
  const suvSize = answers.suvSize || 'any';
  
  // Compact SUVs: CRETA, DUSTER, ECOSPORT, TRACKER, STONIC
  const compactSUVs = ['CRETA', 'DUSTER', 'ECOSPORT', 'TRACKER', 'STONIC', 'TIGGO'];
  
  // Large SUVs: COMPASS, TUCSON, SPORTAGE, RAV4
  const largeSUVs = ['COMPASS', 'TUCSON', 'SPORTAGE', 'RAV4', 'KORANDO'];
  
  const modelUpper = vehicle.modelo.toUpperCase();
  
  if (suvSize === 'compacto' && compactSUVs.some(m => modelUpper.includes(m))) {
    score += 15;
  } else if (suvSize === 'grande' && largeSUVs.some(m => modelUpper.includes(m))) {
    score += 15;
  }
}
```

---

### 4. Adicionar Pergunta "Tipo de Carro?" no Quiz

**Atualmente:** O quiz não pergunta explicitamente o tipo de carroceria.

**Proposta:** Adicionar como pergunta 3 ou 4:

```typescript
{
  question: "Qual tipo de carro você prefere?",
  options: [
    "Hatch (compacto, econômico)",
    "Sedan (conforto, porta-malas)",
    "SUV (espaçoso, robusto)",
    "Pickup (carga, trabalho)",
    "Tanto faz"
  ],
  key: "bodyType"
}
```

---

### 5. Considerar Transmissão no Score

**Muitos veículos da Robust Car têm automático.** Cliente pode preferir:

```typescript
// Transmission preference (5% weight)
const transmissionPref = answers.transmission; // 'automatico', 'manual', 'tanto faz'

if (transmissionPref && transmissionPref !== 'tanto faz') {
  if (vehicle.cambio.toLowerCase().includes(transmissionPref.toLowerCase())) {
    score += 8;
  } else {
    score -= 10;
  }
}
```

Adicionar no quiz:
```typescript
{
  question: "Prefere câmbio automático ou manual?",
  options: ["Automático", "Manual", "Tanto faz"],
  key: "transmission"
}
```

---

## 🔧 Implementação Rápida

### Arquivo: `src/agents/recommendation.agent.ts`

Substitua o bloco das linhas 126-157 por:

```typescript
// Body type (20% weight) - INCREASED
const bodyType = answers.bodyType;
if (bodyType && bodyType !== 'tanto faz') {
  const normalizedBody = this.normalizeBodyType(vehicle.carroceria);
  const normalizedPref = this.normalizeBodyType(bodyType);
  
  if (normalizedBody === normalizedPref) {
    score += 20; // Perfect match
  } else {
    score -= 25; // Wrong type
  }
}

// Transmission preference (5% weight)
const transmission = answers.transmission;
if (transmission && transmission !== 'tanto faz') {
  const vehicleTransmission = vehicle.cambio.toLowerCase();
  const prefTransmission = transmission.toLowerCase();
  
  if (vehicleTransmission.includes(prefTransmission) || 
      prefTransmission.includes(vehicleTransmission)) {
    score += 8;
  } else {
    score -= 10;
  }
}

// People capacity (8% weight)
const people = answers.people || 5;
let vehicleCapacity = 5;
if (vehicle.carroceria.toLowerCase().includes('suv')) vehicleCapacity = 7;
if (vehicle.carroceria.toLowerCase().includes('picape')) vehicleCapacity = 5;

if (vehicleCapacity < people) {
  score -= 30; // Can't fit everyone
} else if (vehicleCapacity === people) {
  score += 5; // Perfect fit
}

// Usage-based bonus (10% weight)
const usage = answers.usage;
if (usage === 'cidade') {
  if (vehicle.carroceria.toLowerCase().includes('hatch')) score += 15;
  if (vehicle.combustivel === 'Flex') score += 5; // Economia na cidade
}
if (usage === 'viagem') {
  if (vehicle.carroceria.toLowerCase().includes('sedan') || 
      vehicle.carroceria.toLowerCase().includes('suv')) {
    score += 15;
  }
  if (vehicle.cambio.toLowerCase().includes('automático')) score += 5; // Conforto em viagem
}
if (usage === 'trabalho') {
  if (vehicle.carroceria.toLowerCase().includes('picape')) score += 20;
  if (vehicle.carroceria.toLowerCase().includes('suv')) score += 10;
}
```

Adicionar método auxiliar:

```typescript
private normalizeBodyType(carroceria: string): string {
  const map: Record<string, string> = {
    'hatchback': 'hatch',
    'hatch': 'hatch',
    'sedan': 'sedan',
    'suv': 'suv',
    'picape': 'pickup',
    'pickup': 'pickup',
    'minivan': 'minivan'
  };
  return map[carroceria.toLowerCase()] || carroceria.toLowerCase();
}
```

---

## 📊 Comparação: Antes vs Depois

### Antes (Sistema Atual)
| Critério | Peso |
|----------|------|
| Orçamento | 30% |
| Ano | 15% |
| Km | 15% |
| **Categoria** | **10%** |
| Uso | 10% |
| Pessoas | 8% |
| Trade-in | 5% |

### Depois (Proposto)
| Critério | Peso |
|----------|------|
| Orçamento | 30% |
| **Categoria** | **20%** ⬆️ |
| Ano | 15% |
| Km | 15% |
| Uso | 10% |
| Pessoas | 8% |
| **Transmissão** | **5%** 🆕 |
| Trade-in | 5% |

---

## 🧪 Como Testar

Após implementar:

```bash
npm run dev
```

Teste via WhatsApp:

1. **Teste SUV:**
   - "Quero um SUV até 120 mil"
   - Espera: CRETA, DUSTER, TRACKER no top 3

2. **Teste Sedan:**
   - "Quero um sedan até 90 mil"
   - Espera: COROLLA, CIVIC, CRUZE no top 3

3. **Teste Hatch:**
   - "Quero um hatch até 70 mil"
   - Espera: ONIX, KWID, MOBI no top 3

4. **Teste Transmissão:**
   - "Quero um carro automático até 100 mil"
   - Espera: Apenas veículos com câmbio automático

---

## ✅ Checklist de Implementação

- [ ] Aumentar peso da categoria (10% → 20%)
- [ ] Adicionar normalização de categorias
- [ ] Adicionar filtro de transmissão (5%)
- [ ] Ajustar bonus por uso (cidade/viagem/trabalho)
- [ ] Adicionar pergunta "Tipo de carro?" no quiz
- [ ] Adicionar pergunta "Transmissão?" no quiz
- [ ] Testar com veículos Robust Car
- [ ] Deploy no Railway
- [ ] Testar em produção

---

**Tempo estimado:** 30-45 minutos de implementação + testes
