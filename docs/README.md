# 🚀 FaciliAuto MVP - WhatsApp Bot

Assistente de Vendas com IA para Concessionárias de Carros Usados via WhatsApp.

## ✨ Features (MVP)

- ✅ Integração WhatsApp com Baileys
- ✅ Agente Orquestrador (identifica intenções)
- ✅ Quiz de Qualificação (8 perguntas)
- ✅ Recomendações com Match Score
- ✅ Sistema de Tracking
- ✅ API REST básica
- ✅ Cache com Redis
- ✅ Logging estruturado

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Cache**: Redis (opcional)
- **WhatsApp**: Baileys
- **IA**: OpenAI GPT-4
- **Logging**: Pino

## 📋 Pré-requisitos

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))
- Redis (opcional) ([Download](https://redis.io/download))
- Conta OpenAI com API Key ([OpenAI](https://platform.openai.com/))
- WhatsApp Business ou pessoal

## 🚀 Instalação

### 1. Clone o repositório

```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/faciliauto_mvp"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="sk-..."
WHATSAPP_NAME="FaciliAuto"
NODE_ENV="development"
PORT=3000
```

### 4. Configure o banco de dados

```bash
# Gera o Prisma Client
npx prisma generate

# Cria as tabelas
npx prisma db push

# Popula com dados de exemplo (10 carros)
npm run db:seed
```

### 5. Inicie o servidor

```bash
npm run dev
```

## 📱 Conectar WhatsApp

1. Execute `npm run dev`
2. Um QR Code aparecerá no terminal
3. Abra o WhatsApp no celular
4. Vá em **Configurações** → **Aparelhos conectados** → **Conectar aparelho**
5. Escaneie o QR Code
6. Aguarde mensagem: `✅ WhatsApp connected successfully!`

## 🧪 Testar o Bot

1. Com o WhatsApp conectado, envie uma mensagem de outro número para o número conectado
2. Mensagem: `Olá, quero comprar um carro`
3. O bot iniciará o quiz automaticamente

### Fluxo de Teste

```
Você: Olá, quero comprar um carro

Bot: Olá! 👋 Bem-vindo à FaciliAuto!
     ...
     🚗 Quer ver nossos veículos disponíveis?
     Digite "sim" para começar

Você: sim

Bot: Perfeito! Vou fazer algumas perguntas...
     💰 Qual seu orçamento disponível?

Você: 50000

Bot: ✅ Anotado!
     🚗 Qual será o uso principal?
     1️⃣ Cidade
     2️⃣ Viagem
     ...

[Continua com 8 perguntas]

Bot: ✅ Perfeito! Tenho todas informações.
     Buscando os melhores veículos... ⏳

Bot: 🎯 Encontrei 3 veículos perfeitos para você!
     [Mostra top 3 com Match Score]
```

## 📊 APIs Disponíveis

### Health Check
```bash
curl http://localhost:3000/health
```

### Estatísticas
```bash
curl http://localhost:3000/stats
```

Retorna:
```json
{
  "conversations": 5,
  "leads": 2,
  "recommendations": 15,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🗄️ Banco de Dados

### Visualizar dados

```bash
npx prisma studio
```

Abre interface web em `http://localhost:5555`

### Schema principal

- **Vehicle**: Veículos no estoque (37 carros)
- **Conversation**: Conversas no WhatsApp
- **Event**: Eventos/ações na conversa
- **Recommendation**: Recomendações geradas
- **Lead**: Leads qualificados
- **Message**: Log de mensagens

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Inicia em modo desenvolvimento
npm run build        # Compila TypeScript
npm run start        # Inicia em produção
npm run db:push      # Aplica schema no banco
npm run db:studio    # Abre Prisma Studio
npm run db:seed      # Popula banco com dados
```

## 📝 Adicionar os 37 Carros do Cliente

Edite `src/scripts/seed.ts` e adicione os dados dos 37 carros:

```typescript
const vehiclesData = [
  {
    marca: 'Toyota',
    modelo: 'Corolla',
    versao: 'XEI 2.0',
    ano: 2019,
    km: 58000,
    preco: '68000',
    cor: 'Prata',
    carroceria: 'Sedan',
    combustivel: 'Flex',
    cambio: 'Automático',
    arCondicionado: true,
    direcaoHidraulica: true,
    airbag: true,
    abs: true,
    descricao: 'Veículo em excelente estado...',
    fotoUrl: 'https://exemplo.com/foto.jpg', // Opcional
  },
  // ... mais 36 carros
];
```

Depois execute:
```bash
npm run db:seed
```

## 🔍 Logs

O sistema usa Pino para logging estruturado. Em desenvolvimento, logs são coloridos e legíveis.

Níveis de log:
- `debug`: Detalhes técnicos
- `info`: Informações importantes
- `warn`: Avisos
- `error`: Erros

## ⚡ Performance

### Custos por Atendimento

- WhatsApp (Baileys): **R$ 0** (grátis)
- GPT-4: **~R$ 0,64/atendimento**
- PostgreSQL: **R$ 0** (auto-hospedado)
- Redis: **R$ 0** (opcional, auto-hospedado)

**Total: ~R$ 0,64 por cliente atendido**

### Escalabilidade

Este MVP suporta:
- ~100-200 conversas/dia
- ~1000 mensagens/dia
- 1 concessionária

Para escalar:
- Use WhatsApp Business API (pago, mais estável)
- Deploy em cloud (Railway, Render, AWS)
- Add load balancing
- Use Redis para cache distribuído

## 🚨 Troubleshooting

### WhatsApp desconecta

**Problema**: Baileys perde conexão frequentemente

**Solução**:
1. Certifique-se que o celular está com internet
2. Não use o WhatsApp Web em outros navegadores simultaneamente
3. Considere migrar para WhatsApp Business API (mais estável)

### OpenAI API error

**Problema**: `Error: Insufficient quota`

**Solução**:
1. Verifique saldo na conta OpenAI
2. Adicione créditos em https://platform.openai.com/billing
3. Ou use GPT-3.5-turbo (mais barato) no `src/lib/openai.ts`

### Database connection failed

**Problema**: `Error: Can't reach database server`

**Solução**:
1. Verifique se PostgreSQL está rodando: `sudo service postgresql status`
2. Confirme DATABASE_URL no `.env`
3. Teste conexão: `psql -h localhost -U seu_usuario -d faciliauto_mvp`

## 📈 Próximos Passos (V2)

- [ ] Avaliação trade-in com GPT-4 Vision
- [ ] Histórico veicular (Carfax)
- [ ] Comparador de veículos
- [ ] Simulador de financiamento
- [ ] Agendamento de test-drive
- [ ] Dashboard administrativo
- [ ] Multi-concessionária
- [ ] WhatsApp Business API

## 🤝 Contribuindo

Este é um MVP fechado para um cliente específico. Contribuições serão aceitas após validação inicial.

## 📄 Licença

Proprietário - Todos os direitos reservados.

---

**Desenvolvido com ❤️ para concessionárias de veículos usados**

**Status**: 🚀 MVP - Em Desenvolvimento
