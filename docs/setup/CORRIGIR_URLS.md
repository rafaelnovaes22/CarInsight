# 🔗 Correção de URLs - RobustCar

## 🐛 Problema Identificado

Os links dos veículos da RobustCar estão com caracteres especiais mal codificados:

```
❌ Antes: https://robustcar.com.br/carros/Hyundai/Hb20/10m-Comfort/Hyundai-Hb20-10m-Comfort-2025-S�o-Paulo-Sao-Paulo-7603120.html
✅ Depois: https://robustcar.com.br/carros/Hyundai/Hb20/10m-Comfort/Hyundai-Hb20-10m-Comfort-2025-Sao-Paulo-Sao-Paulo-7603120.html
```

Caracteres problemáticos:
- `S�o` → `Sao`
- `H�BRIDO` → `Hibrido`
- `�`, `�`, `�`, etc. → `a`, `e`, `o`, etc.

---

## 🔧 Solução em 2 Passos

### Cenário 1: Banco ainda NÃO foi populado

Se você ainda não executou `npm run db:seed:robustcar`:

```powershell
# 1. Corrigir o arquivo JSON
npm run vehicles:fix-urls

# 2. Popular o banco com URLs corretas
npm run db:seed:robustcar
```

**Pronto!** Os veículos serão inseridos com URLs corretas.

---

### Cenário 2: Banco JÁ foi populado

Se você já executou o seed e os veículos estão no banco com URLs quebradas:

**Opção A - Recriar do zero (Recomendado):**
```powershell
# 1. Corrigir o arquivo JSON
npm run vehicles:fix-urls

# 2. Limpar e repopular o banco
npm run db:seed:robustcar
```

**Opção B - Atualizar URLs existentes:**
```powershell
# 1. Corrigir o arquivo JSON (para futuros seeds)
npm run vehicles:fix-urls

# 2. Atualizar URLs dos veículos já cadastrados
npm run vehicles:update-urls
```

---

## 📝 O que cada script faz

### `npm run vehicles:fix-urls`
- Lê `scripts/robustcar-vehicles.json`
- Corrige todos os caracteres mal codificados nas URLs
- Cria backup em `scripts/robustcar-vehicles.backup.json`
- Salva arquivo corrigido

### `npm run vehicles:update-urls`
- Conecta no banco de dados
- Busca todos os veículos
- Corrige URLs quebradas
- Atualiza campos: `url`, `fotoUrl`, `fotosUrls`

---

## ✅ Verificação

Após executar os scripts, verifique se funcionou:

```powershell
# Abrir Prisma Studio
npx prisma studio

# Verificar campo "url" de qualquer veículo
# Deve estar sem caracteres estranhos (�)
```

Ou via código:
```typescript
const vehicle = await prisma.vehicle.findFirst();
console.log(vehicle.url);
// Deve mostrar URL limpa sem �
```

---

## 🎯 Comandos Rápidos

```powershell
# Cenário 1: Banco vazio
npm run vehicles:fix-urls && npm run db:seed:robustcar

# Cenário 2: Banco populado - Recriar
npm run vehicles:fix-urls && npm run db:seed:robustcar

# Cenário 2: Banco populado - Atualizar
npm run vehicles:fix-urls && npm run vehicles:update-urls
```

---

## 📊 Exemplo de Saída

```
🔧 Corrigindo URLs do arquivo robustcar-vehicles.json...

📦 Carregados 30 veículos

✅ HYUNDAI HB20 2025
   Antes: https://robustcar.com.br/carros/Hyundai/Hb20/10m-Comfort/Hyundai-Hb20-10m-Comfort-2025-S�o-Paulo-Sao-Paulo-7603120.html
   Depois: https://robustcar.com.br/carros/Hyundai/Hb20/10m-Comfort/Hyundai-Hb20-10m-Comfort-2025-Sao-Paulo-Sao-Paulo-7603120.html

✅ HYUNDAI HB20S 2025
   Antes: https://robustcar.com.br/carros/Hyundai/Hb20s/10-M-Comfort/Hyundai-Hb20s-10-M-Comfort-2025-S�o-Paulo-Sao-Paulo-7606169.html
   Depois: https://robustcar.com.br/carros/Hyundai/Hb20s/10-M-Comfort/Hyundai-Hb20s-10-M-Comfort-2025-Sao-Paulo-Sao-Paulo-7606169.html

📊 Resumo:
   ✅ URLs corrigidas: 28
   📦 Total de veículos: 30
   💾 Backup salvo em: robustcar-vehicles.backup.json

✅ Correção concluída com sucesso!
```

---

## 🚨 Troubleshooting

### Erro: "Cannot find module"
```powershell
npm install
```

### Erro: "Database connection failed"
Verifique se PostgreSQL está rodando:
```powershell
Get-Service postgresql-x64-16
```

### Backup não foi criado
O backup é criado automaticamente em `scripts/robustcar-vehicles.backup.json`. Se precisar restaurar:
```powershell
copy scripts\robustcar-vehicles.backup.json scripts\robustcar-vehicles.json
```

---

**Status:** ✅ Scripts criados e prontos para uso

**Próximo passo:** Execute `npm run vehicles:fix-urls` para corrigir as URLs
