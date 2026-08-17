# Política de IA

**Documento:** GOV-POL-001 · **Versão:** 1.0 · **Aprovado em:** 2026-07-29 · **Próxima revisão:** 2027-07-29
**Aprovador:** Rafael de Novaes (ver `governance/roles/RACI.md`)
**Referência:** ISO/IEC 42001:2023 cláusula 5.2, Anexo A.2

---

## 1. Propósito

Esta política define como sistemas de inteligência artificial são construídos, operados e supervisionados neste produto. Ela existe para que qualquer decisão sobre IA aqui possa ser explicada a um cliente, a um titular de dados ou a um auditor, sem depender da memória de quem escreveu o código.

Aplica-se a todos os sistemas listados em `governance/inventory/ai-systems.yaml`, a todas as pessoas que os desenvolvem ou operam, e aos fornecedores de modelo registrados em `governance/suppliers/supplier-register.yaml`.

## 2. Princípios

**Transparência.** O usuário sempre sabe que está falando com um sistema automatizado. Disclosure aparece em toda entrada de conversa, em follow-ups e em respostas sobre dados pessoais. Nenhum prompt instrui o sistema a negar que é IA.

**Supervisão humana.** Toda decisão com consequência para o usuário é validada por código determinístico ou por pessoa. O sistema nunca encerra uma conversa sem oferecer saída para humano, e escala automaticamente quando detecta que está travado.

**Fundamentação.** O sistema responde a partir de dados recuperados do banco real. Não inventa registro que não existe: a filtragem é SQL sobre o estoque, e a recomendação carrega a evidência que a justifica.

**Privacidade por padrão.** Dado pessoal é minimizado, mascarado em log, retido por prazo definido e excluído a pedido do titular por comando conversacional. Base legal e ciclo de vida estão em `governance/data/`.

**Qualidade medida, não afirmada.** Mudança de prompt ou de modelo só entra em produção depois de passar pelas eval suites. Qualidade, custo e latência são monitorados de forma contínua, com alerta em degradação.

**Robustez.** Falha de um provedor de modelo não derruba o produto: existe cadeia de fallback com circuit breaker. Tentativa de manipulação do sistema é detectada e bloqueada antes de chegar ao modelo.

**Responsabilidade rastreável.** Toda execução é registrada com custo, tokens, latência e resultado. Papéis e responsabilidades estão declarados e não são presumidos.

## 3. Compromissos

1. Manter inventário atualizado dos sistemas de IA, modelos e fornecedores em uso, verificado automaticamente em CI.
2. Avaliar risco e impacto antes de colocar um sistema de IA novo em produção, e reavaliar a cada mudança material.
3. Manter model card por modelo em produção, com uso pretendido, limitações e data da última avaliação.
4. Registrar e tratar incidentes de IA segundo `governance/incidents/incident-response.md`.
5. Executar auditoria interna semestral e análise crítica trimestral.
6. Não usar dado pessoal de usuário para treinar modelos, nem contratar fornecedor que o faça sem consentimento explícito.
7. Não implantar sistema de IA que tome decisão irreversível sobre uma pessoa sem gate humano.

## 4. Usos vedados

- Ocultar do usuário que ele interage com IA, ou simular ser humano quando perguntado diretamente.
- Afirmar disponibilidade, preço ou condição comercial que não venha do dado de origem.
- Persuasão manipulativa, pressão de urgência artificial ou exploração de vulnerabilidade do interlocutor.
- Inferir ou tratar dado pessoal sensível (saúde, biometria, convicção, origem racial) sem base legal específica.
- Decidir sozinho sobre crédito, contratação ou qualquer efeito jurídico para uma pessoa.

## 5. Governança desta política

Revisão anual, ou antes disso se houver: incidente de severidade alta, mudança regulatória relevante (LGPD, EU AI Act), entrada em vertical novo, ou mudança na arquitetura de IA. Toda revisão é registrada no histórico abaixo e passa pelo aprovador definido no RACI.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-07-29 | Versão inicial, junto com a implantação do AIMS |
