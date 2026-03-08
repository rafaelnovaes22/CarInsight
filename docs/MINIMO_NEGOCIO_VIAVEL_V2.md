# Mínimo Negócio Viável v2 — CarInsight

**Nome do Projeto:** CarInsight
**Metodologia:** Camila Farani
**Posicionamento:** Plataforma de inteligência comercial para revendas de seminovos

---

## 1. Características gerais da sua persona

Renato Cruzato, ~40-45 anos, Guarulhos-SP, MBA (FIAP). Proprietário de revenda de seminovos de pequeno/médio porte (~30-40 veículos, R$ 16k-135k). Empreendedor mão na massa, administra tudo sozinho ou com equipe enxuta. Usa WhatsApp Business como canal principal de vendas e Instagram para divulgação. Toma decisões no feeling — não tem dados estruturados sobre seu próprio negócio.

## 2. Conhecimentos técnicos da sua persona

Conhecimento básico de tecnologia — usa celular, WhatsApp e redes sociais no dia a dia. Não tem equipe de TI. Sabe usar planilhas simples mas não domina sistemas complexos. Entende profundamente do mercado automotivo (avaliação, precificação, financiamento), mas não de automação, IA ou análise de dados. Consulta Tabela FIPE manualmente e faz simulação de financiamento por telefone com o correspondente bancário.

## 3. Dores da sua persona

- **Precifica no achismo** — não sabe se o preço do carro está acima ou abaixo do mercado, perde margem ou espanta cliente
- **Não sabe quais carros comprar** — adquire veículos para estoque sem dados de demanda; alguns encalham por meses
- **Sem visão do funil de vendas** — não sabe quantos leads recebe, quantos viram visita, quantos fecham
- **Perde clientes no meio do funil** — esquece de fazer follow-up, não sabe quem está quente ou frio
- **Financiamento é gargalo** — simula manualmente com correspondente, demora horas, cliente desiste
- **Concorrência digital** — lojas maiores têm sistemas integrados; ele compete com celular e caderninho
- **Gasta tempo com atendimento repetitivo** — responde as mesmas perguntas dezenas de vezes por dia

## 4. Objetivos da sua persona

- Saber exatamente quais carros comprar para o estoque (dados de demanda real)
- Precificar com base em dados de mercado, não em intuição
- Ter visão completa do funil: lead → interesse → visita → proposta → venda
- Fechar financiamento em minutos, não em horas
- Entender o comportamento dos seus clientes (o que procuram, faixa de preço, preferências)
- Tomar decisões de negócio baseadas em dados, não em feeling
- Automatizar o operacional para focar no estratégico (fechar negócios)

## 5. Problema

Donos de revendas de seminovos operam no escuro: não sabem quais carros têm mais demanda, precificam por intuição, perdem leads por falta de follow-up e não têm visibilidade do próprio funil de vendas. Enquanto isso, ferramentas genéricas (Meta Business AI, chatbots no-code) resolvem apenas o atendimento superficial — mas não entregam inteligência comercial do setor automotivo.

## 6. Solução

Plataforma de inteligência comercial para revendas de seminovos que captura dados via WhatsApp (atendimento automatizado com IA), processa e entrega ao dono da loja:
- **CRM automotivo** com funil visual de leads (interesse → visita → proposta → venda)
- **Analytics de demanda** — quais marcas, modelos e faixas de preço os clientes mais procuram
- **Precificação inteligente** — comparativo automático com Tabela FIPE e mercado regional
- **Simulador de financiamento integrado** — parcela calculada em tempo real na conversa
- **Score de lead** — classificação automática de intenção de compra (quente/morno/frio)
- **Follow-up inteligente** — reengajamento automático baseado no perfil e interesse do lead
- **Relatórios de performance** — taxa de conversão, tempo médio de venda, carros que mais convertem

O bot WhatsApp é o **canal de captura**, não o produto. O valor está na inteligência que ele gera.

## 7. Proposta de Valor

"Pare de vender no escuro. O CarInsight transforma cada conversa no WhatsApp em dado de inteligência comercial — você descobre quais carros comprar, como precificar e quais clientes estão prontos para fechar."

## 8. Conceito High Level

**"É o Business Intelligence que faltava para revendas de seminovos."**

Analogia com grandes players:
- Captação via WhatsApp (como Meta Business AI faz) +
- CRM de vendas automotivo (como um Salesforce vertical) +
- Analytics de mercado (como um DataStudio para carros) +
- Financiamento integrado (como um correspondente bancário digital)

Tudo numa plataforma única, simples o suficiente para o Renato usar no celular.

## 9. Vantagem Competitiva

| Diferencial | Meta Business AI faz? | Chatbot genérico faz? |
|---|---|---|
| CRM automotivo com funil de vendas | Não | Não |
| Analytics de demanda (carros mais buscados) | Não | Não |
| Precificação vs. FIPE automatizada | Não | Não |
| Simulação de financiamento na conversa | Não | Não |
| Score de lead automotivo | Não | Não |
| Benchmark entre revendas (rede) | Não | Não |
| Integração com financeiras (BV, Santander) | Não | Não |
| Bot de atendimento 24/7 | **Sim** | Sim |

**O bot é commodity. A inteligência comercial automotiva é o moat.**

Defensabilidade adicional:
- **Efeito de rede** — quanto mais revendas usam, mais dados de mercado (demanda, preço, conversão) a plataforma agrega, melhor fica para todos
- **Integrações verticais** — FIPE, Denatran, financeiras, seguradoras. Cada integração é barreira de entrada
- **Dados proprietários** — histórico de demanda e conversão por região/modelo que nenhuma BigTech possui

## 10. Canais

- **Venda consultiva direta** — abordagem presencial/WhatsApp em revendas de Guarulhos e Grande SP (mercado inicial)
- **Parcerias com financeiras** — BV, Santander, Itaú auto. Elas ganham volume de simulação; nós ganhamos distribuição
- **Associações do setor** — Fenauto, sindicatos de revendedores, despachantes
- **Indicação com incentivo** — revendedor indica revendedor, ganha desconto na mensalidade
- **Conteúdo educativo** — Instagram/YouTube com "dados do mercado automotivo" (ex: "os 5 carros mais procurados da semana em SP") — atrai revendedores organicamente
- **Google Ads** segmentado: "sistema para loja de carros", "CRM revenda seminovos"

## 11. Mínima Estrutura Viável

**Já construído (MVP atual):**
- Bot WhatsApp com IA multi-agente (atendimento, recomendação, financiamento)
- Busca semântica por veículos com pgvector
- Sistema de follow-up automático
- Dashboard básico de métricas

**Construir para v2 (incremental):**
- Dashboard de inteligência comercial (demanda, conversão, precificação)
- Integração com API da Tabela FIPE
- Simulador de financiamento (API de financeiras ou cálculo próprio)
- Score de lead automatizado
- Funil visual de vendas (CRM)

**Custos:**
- Hosting: Railway (~$5-20/mês)
- LLM APIs: OpenAI/Groq (~$30-80/mês por loja)
- WhatsApp Cloud API: gratuito até 1000 conversas/mês
- FIPE API: gratuita (APIs públicas)
- **Equipe mínima:** 1 dev full-stack + 1 comercial/CS

## 12. Receitas Escaláveis

- **SaaS mensal escalonado:**
  - Starter (R$ 297/mês) — bot + CRM básico + 500 conversas
  - Pro (R$ 597/mês) — analytics + financiamento + follow-up ilimitado
  - Business (R$ 997/mês) — benchmark de mercado + multi-atendente + API aberta
- **Setup inicial:** R$ 1.000-2.000 (onboarding + cadastro de estoque)
- **Revenue share em financiamento:** comissão por lead que fecha financiamento via plataforma
- **Dados de mercado (futuro):** relatórios agregados de demanda para montadoras, financeiras e seguradoras
- **Modelo escalável:** multi-tenant, custo marginal baixo; efeito de rede aumenta valor a cada cliente

## 13. OKRs, KPIs e 3QeS

**OKR:** Provar que o CarInsight gera inteligência comercial que aumenta vendas e reduz estoque parado

**KPIs:**

- Leads qualificados gerados/mês (meta: 50+ por loja)
- Taxa de conversão lead→venda (meta: 2x vs. baseline manual)
- Tempo médio do ciclo de venda (meta: redução de 30%)
- Veículos com giro >60 dias (meta: redução de 40%)
- Precisão da precificação vs. FIPE (meta: desvio <5%)
- Receita média por loja (meta: R$ 497+/mês)
- Churn mensal (meta: <5%)
- NPS do dono da loja (meta: >50)

**3QeS (3 Questões essenciais):**

1. Os donos de loja tomam decisões melhores (compra de estoque, preço, follow-up) com os dados do CarInsight?
2. A plataforma gera ROI claro — o dono consegue apontar vendas que não teria feito sem o CarInsight?
3. O efeito de rede funciona — dados agregados de múltiplas lojas geram valor incremental que justifica retenção?
