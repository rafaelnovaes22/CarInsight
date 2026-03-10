# Mínimo Negócio Viável — CarInsight

**Nome do Projeto:** CarInsight
**Metodologia:** Camila Farani

---

## 1. Características gerais da sua persona

Renato Cruzato, ~40-45 anos, Guarulhos-SP, MBA (FIAP). Proprietário de revenda de seminovos de pequeno/médio porte (~30-40 veículos, R$ 16k-135k). Empreendedor mão na massa, administra tudo sozinho ou com equipe enxuta. Usa WhatsApp Business como canal principal de vendas e Instagram para divulgação.

## 2. Conhecimentos técnicos da sua persona

Conhecimento básico de tecnologia — usa celular, WhatsApp e redes sociais no dia a dia. Não tem equipe de TI. Sabe usar planilhas simples mas não domina sistemas complexos. Entende profundamente do mercado automotivo (avaliação, precificação, financiamento), mas não de automação ou IA.

## 3. Dores da sua persona

- Perde vendas por não responder fora do horário comercial (cliente vai para a concorrência)
- Sobrecarregado respondendo as mesmas perguntas repetitivas (preço, km, financiamento)
- Esquece de fazer follow-up com clientes interessados
- Gasta tempo com curiosos que não vão comprar (leads não qualificados)
- Sem dados sobre o próprio negócio (não sabe taxa de conversão, carros mais procurados)
- Medo de perder a essência do atendimento humanizado ao usar tecnologia

## 4. Objetivos da sua persona

- Vender mais carros sem aumentar equipe
- Atender clientes 24/7 (noite e fim de semana)
- Nunca mais perder venda por demora no retorno
- Ter controle sobre seus leads e pipeline de vendas
- Se diferenciar da concorrência com atendimento profissional e moderno
- Ter tempo para focar no que importa: fechar negócios presencialmente

## 5. Problema

Donos de revendas de seminovos perdem até 40% das oportunidades de venda porque não conseguem responder clientes no WhatsApp fora do horário comercial, esquecem de fazer follow-up e gastam horas respondendo perguntas repetitivas em vez de focar no fechamento.

## 6. Solução

Assistente de vendas com IA para WhatsApp que atende clientes 24/7, responde dúvidas sobre o estoque automaticamente (preço, km, fotos, financiamento), qualifica leads por intenção de compra, agenda visitas e faz follow-up automático — tudo com tom natural e humanizado, com handoff para o vendedor humano na hora de fechar.

## 7. Proposta de Valor

"Nunca mais perca uma venda por falta de resposta. O CarInsight transforma seu WhatsApp em um vendedor incansável que atende 24/7, conhece todo seu estoque e entrega leads quentes prontos para fechar."

## 8. Conceito High Level

**"É como ter um vendedor virtual que conhece todo seu estoque e nunca dorme."**

Fit com grandes players: ChatGPT (conversação natural) + CRM automotivo (gestão de leads) + WhatsApp Business API (canal direto), integrados numa solução única para pequenas revendas.

## 9. Vantagem Competitiva

- Especializado no setor automotivo (não é chatbot genérico)
- IA multi-agente com busca semântica por veículos (entende "carro pra família até 70 mil")
- Follow-up automático inteligente (re-engaja clientes que esfriaram)
- Tom conversacional brasileiro natural (não parece robô)
- Handoff transparente para vendedor humano
- Custo acessível para loja de pequeno porte (não precisa de equipe de TI)

## 10. Canais

- **Venda direta** para revendas via WhatsApp/Instagram do próprio CarInsight
- **Indicação** entre donos de revendas (comunidade do setor)
- **Instagram/TikTok** com cases de resultado (antes/depois de métricas)
- **Parcerias** com despachantes, financeiras e associações de revendedores (Fenauto)
- **Google Ads** segmentado: "chatbot para loja de carros", "automação WhatsApp revenda"

## 11. Mínima Estrutura Viável

- **Custos fixos:** Railway (hosting ~$5-20/mês), OpenAI API (~$30-50/mês), Meta WhatsApp API (gratuito até 1000 conversas/mês), domínio
- **Custos variáveis:** proporcional ao volume de mensagens (API LLM)
- **Equipe mínima:** 1 desenvolvedor full-stack + 1 pessoa comercial/CS
- **Stack:** Node.js, TypeScript, LangGraph, PostgreSQL, WhatsApp Cloud API
- **Já construído:** MVP funcional com 7 agentes IA, busca semântica, follow-up, dashboard

## 12. Receitas Escaláveis

- **SaaS mensal por loja:** planos por volume (ex: R$ 197/mês básico, R$ 497/mês pro)
- **Setup inicial:** configuração + cadastro de estoque (R$ 500-1.000)
- **Upsell:** integração com financeiras, relatórios avançados, multi-atendente
- **Modelo escalável:** mesmo software serve N lojas (multi-tenant), custo marginal baixo por cliente adicional

## 13. OKRs, KPIs e 3QeS

**OKR:** Provar que o CarInsight aumenta vendas de revendas de seminovos

**KPIs:**

- Taxa de resposta fora do horário (meta: 100%)
- Tempo médio de primeira resposta (meta: <30 segundos)
- Leads qualificados gerados/mês
- Taxa de agendamento de visitas via bot
- Taxa de conversão lead→venda (comparativo antes/depois)
- NPS do dono da loja

**3QeS (3 Questões essenciais):**

1. O bot converte mais leads em visitas do que o atendimento manual?
2. Os donos de loja renovam a assinatura após o primeiro mês?
3. O custo de aquisição de cliente (CAC) é sustentável vs. receita mensal (LTV)?
