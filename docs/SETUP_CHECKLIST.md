# ✅ Setup Checklist - FaciliAuto MVP

## 📋 Pré-requisitos

### Softwares Necessários

- [ ] Node.js 18+ instalado
  ```bash
  node --version  # deve mostrar v18+ ou v20+
  ```

- [ ] PostgreSQL 14+ instalado e rodando
  ```bash
  psql --version
  sudo service postgresql status
  ```

- [ ] Git instalado
  ```bash
  git --version
  ```

- [ ] (Opcional) Redis instalado
  ```bash
  redis-cli ping  # deve retornar PONG
  ```

### Contas e Credenciais

- [ ] Conta OpenAI criada
- [ ] API Key da OpenAI obtida (https://platform.openai.com/api-keys)
- [ ] Créditos na conta OpenAI (mínimo $5)
- [ ] WhatsApp Business ou pessoal disponível

---

## 🚀 Instalação Passo a Passo

### 1. Preparar Ambiente

- [ ] Navegar até o diretório do projeto
  ```bash
  cd /home/rafaelnovaes22/project/faciliauto-mvp
  ```

- [ ] Instalar dependências
  ```bash
  npm install
  ```
  _Aguarde ~2-3 minutos_

### 2. Configurar Banco de Dados

- [ ] Criar database PostgreSQL
  ```bash
  sudo -u postgres psql
  CREATE DATABASE faciliauto_mvp;
  CREATE USER faciliauto WITH PASSWORD 'senha_forte_123';
  GRANT ALL PRIVILEGES ON DATABASE faciliauto_mvp TO faciliauto;
  \q
  ```

- [ ] Copiar arquivo .env
  ```bash
  cp .env.example .env
  ```

- [ ] Editar .env com suas credenciais
  ```bash
  nano .env  # ou use seu editor preferido
  ```

  Preencher:
  ```env
  DATABASE_URL="postgresql://faciliauto:senha_forte_123@localhost:5432/faciliauto_mvp"
  OPENAI_API_KEY="sk-..."  # Sua key da OpenAI
  REDIS_URL="redis://localhost:6379"  # Opcional
  ```

- [ ] Aplicar schema no banco
  ```bash
  npx prisma generate
  npx prisma db push
  ```
  _Deve mostrar: "✔ Database synchronized"_

- [ ] Popular com dados de exemplo
  ```bash
  npm run db:seed
  ```
  _Deve mostrar: "🎉 Seed completed successfully!"_

- [ ] (Opcional) Verificar dados
  ```bash
  npx prisma studio
  ```
  _Abre http://localhost:5555 - Verifique tabela Vehicle_

### 3. Testar Instalação

- [ ] Iniciar servidor
  ```bash
  npm run dev
  ```

- [ ] Verificar logs
  Deve aparecer:
  ```
  ✅ Database connected
  🚀 Server running on port 3000
  🔄 Initializing WhatsApp...
  📱 Scan QR Code:
  [QR Code aparece aqui]
  ```

- [ ] Testar API (em outro terminal)
  ```bash
  curl http://localhost:3000/health
  ```
  Deve retornar: `{"status":"ok","timestamp":"..."}`

### 4. Conectar WhatsApp

- [ ] QR Code apareceu no terminal?
- [ ] Abrir WhatsApp no celular
- [ ] Ir em **Configurações** → **Aparelhos conectados**
- [ ] Clicar em **Conectar aparelho**
- [ ] Escanear QR Code no terminal
- [ ] Aguardar mensagem: `✅ WhatsApp connected successfully!`

### 5. Testar Bot

- [ ] De outro número, enviar mensagem para o WhatsApp conectado
- [ ] Mensagem de teste: `Olá, quero comprar um carro`
- [ ] Bot deve responder automaticamente
- [ ] Completar o quiz (8 perguntas)
- [ ] Bot deve mostrar 3 recomendações

---

## 🧪 Testes Funcionais

### Teste 1: Fluxo Completo

- [ ] Enviar: `Olá, quero comprar um carro`
- [ ] Bot responde com saudação
- [ ] Enviar: `sim`
- [ ] Bot inicia quiz
- [ ] Responder às 8 perguntas:
  1. `50000` (orçamento)
  2. `1` (cidade)
  3. `4` (pessoas)
  4. `não` (trade-in)
  5. `2018` (ano mínimo)
  6. `80000` (km máxima)
  7. `2` (sedan)
  8. `2` (até 1 mês)
- [ ] Bot deve gerar 3 recomendações com Match Score
- [ ] Recomendações devem fazer sentido com o perfil

### Teste 2: Verificar Banco de Dados

```bash
npx prisma studio
```

Verificar:
- [ ] Tabela **Conversation**: Deve ter 1 registro
- [ ] Tabela **Event**: Deve ter múltiplos eventos (started, quiz_completed, etc.)
- [ ] Tabela **Recommendation**: Deve ter 3 registros
- [ ] Tabela **Message**: Deve ter histórico de mensagens

### Teste 3: API Stats

```bash
curl http://localhost:3000/stats
```

Deve retornar:
```json
{
  "conversations": 1,
  "leads": 0,
  "recommendations": 3,
  "timestamp": "..."
}
```

---

## 🎯 Checklist de Validação

### Funcionalidades Core

- [ ] Bot responde mensagens automaticamente
- [ ] Quiz de 8 perguntas funciona
- [ ] Validação de respostas funciona
- [ ] Match Score é calculado (0-100)
- [ ] Top 3 recomendações são geradas
- [ ] Justificativas são personalizadas
- [ ] Conversas são salvas no banco
- [ ] Eventos são rastreados
- [ ] Logs são legíveis

### Performance

- [ ] Resposta do bot < 3 segundos
- [ ] OpenAI API funcionando
- [ ] Banco de dados conectado
- [ ] Sem erros no console

### Qualidade

- [ ] Mensagens do bot são naturais
- [ ] Recomendações fazem sentido
- [ ] Erros são tratados gracefully
- [ ] QR Code regenera se desconectar

---

## 📝 Próximos Passos

Após validar que tudo funciona:

1. **Adicionar os 37 carros do cliente**
   - Editar `src/scripts/seed.ts`
   - Adicionar dados reais dos veículos
   - Executar `npm run db:seed`

2. **Testar com cliente real**
   - Fornecer número WhatsApp para cliente testar
   - Coletar feedback
   - Ajustar mensagens conforme necessário

3. **Ajustes finos**
   - Melhorar prompts do GPT-4
   - Ajustar algoritmo de Match Score
   - Adicionar fotos dos veículos

4. **Deploy (opcional)**
   - Railway: https://railway.app
   - Render: https://render.com
   - Configurar variáveis de ambiente
   - Monitorar logs

---

## 🚨 Troubleshooting Rápido

### Erro: "Cannot find module"
```bash
npm install
npx prisma generate
```

### Erro: "Database connection failed"
```bash
sudo service postgresql start
# Verificar DATABASE_URL no .env
```

### Erro: "OpenAI API error"
```bash
# Verificar OPENAI_API_KEY no .env
# Confirmar créditos em https://platform.openai.com/billing
```

### WhatsApp não conecta
```bash
# Deletar sessão antiga
rm -rf baileys_auth_info/
# Reiniciar: npm run dev
# Escanear novo QR Code
```

### Bot não responde
```bash
# Verificar logs no terminal
# Confirmar que WhatsApp está conectado
# Testar de outro número (não do próprio)
```

---

## ✅ Checklist Final

Antes de considerar MVP pronto:

- [ ] Todos testes acima passando
- [ ] 37 carros do cliente cadastrados
- [ ] Cliente testou e aprovou
- [ ] Rastreamento de vendas configurado
- [ ] Processo de handoff para vendedor funciona
- [ ] README.md atualizado com instruções
- [ ] .env.example tem todas variáveis necessárias
- [ ] Código commitado no Git

---

**Status**: ⏳ Aguardando instalação e testes

**Tempo estimado**: 1-2 horas para setup completo

**Próximo milestone**: Primeira venda atribuída! 🎉
