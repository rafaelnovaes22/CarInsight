# Análise crítica pela direção — 2026 Q3

**Documento:** GOV-MR-001 · **Data:** 2026-07-29 · **Conduzida por:** AI Owner
**Referência:** ISO/IEC 42001:2023 cláusula 9.3 · **Próxima:** 2026-10-29 (trimestral)

---

## 1. Situação das ações da revisão anterior

Primeira análise crítica. Não há ações anteriores.

## 2. Mudanças de contexto relevantes

- **EU AI Act** em vigência progressiva; as obrigações de transparência do art. 50 se aplicam a este sistema e estão atendidas por disclosure.
- **LGPD**: guia de boas práticas de IA da ANPD em consulta pública, sem obrigação nova ainda.
- **Produto**: entrada de segunda vertical (saúde) prevista. Vertical de saúde muda a análise de risco de forma material e **exige novo AIIA antes do go-live**, não depois.
- **Equipe**: operação de uma pessoa. É a maior fragilidade estrutural do AIMS, e é honesto dizer que nenhum documento resolve isso.

## 3. Desempenho contra os objetivos

| Objetivo | Alvo | Situação | Comentário |
|---|---|---|---|
| OBJ-001 precision@3 | ≥ 0,70 | Medido no golden dataset | Instrumentado e rodando em CI |
| OBJ-002 aderência de papel adversarial | 100% | Verde no modelo mais fraco | Nasceu do incidente de 2026-03-13 |
| OBJ-003 custo por conversa | ≤ US$ 0,02 | Instrumentado por mensagem | Ainda sem série histórica consolidada |
| OBJ-004 latência p95 | < 5 s | Atendido | Baseline anterior era ~60 s |
| OBJ-005 bloqueio de injection | 100% dos padrões | Verde | 25+ padrões cobertos |
| OBJ-006 execução da retenção | diária | **Ativado nesta data** | Antes não executava (NC-002) |
| OBJ-007 supervisão humana | handoff sempre disponível | Atendido | 3 circuit breakers forçam handoff |
| OBJ-008 inventário fiel ao código | zero divergência | Verde | Verificado em CI |

## 4. Incidentes e não conformidades do período

- **2 incidentes** documentados retroativamente: vazamento de system prompt no fallback (S2, fechado) e jailbreak de persona (S3, fechado, bloqueado neste sistema).
- **4 não conformidades**: NC-001, NC-002 e NC-003 fechadas na data; **NC-004 aberta** (registro de treinamento, prazo 2026-09-30).
- Padrão observado nos dois incidentes: **a falha estava no elo mais fraco, não no caminho principal**. Fallback barato e prompt sem limite explícito. A resposta estrutural (avaliar no pior modelo da cadeia) já está institucionalizada no gate de mudança.

## 5. Adequação de recursos

Insuficiente por natureza: uma pessoa acumula AI Owner, Engenheiro e Encarregado, o que torna a segregação de funções nominal. A mitigação é deslocar controle para automação, e é exatamente a direção da Fase 5 (validadores em CI): o que o CI verifica não depende de disciplina humana.

## 6. Decisões

1. **Manter SYS-001 e SYS-002 em autonomia "assistida".** Não promover a autônomo neste trimestre: falta série histórica de eval e de custo.
2. **Aprovar o risco residual** dos 10 riscos do registro, conforme registrado individualmente.
3. **Prioridade do trimestre:** fechar GAP-002 (análise de viés por subgrupo, até 2026-10-31), por ser o único risco de dano ao usuário sem controle específico.
4. **Exigir AIIA novo antes do go-live da vertical de saúde.** Sem AIIA aprovado, não sobe.
5. **NC-004** com prazo em 2026-09-30.
6. **Manter a comunicação externa precisa:** "controles alinhados à ISO 42001, AIMS implantado e auditado internamente, sem certificação". Uso da palavra "certificado" fica vedado.

## 7. Oportunidades de melhoria identificadas

- De-identificação de dado de conversa para uso analítico, hoje inexistente (limita análise legítima).
- Alerta ativo quando o job de retenção falha por mais de 48 h, em vez de depender de leitura de log.
- Verificação automatizada de mudança de termos de fornecedor (GAP-003).
- Acessibilidade: canal só texto, em português, exclui parte dos usuários. Áudio já existe como capacidade no projeto e poderia atender parte disso.
