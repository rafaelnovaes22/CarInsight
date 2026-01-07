# Plano de Correção: Transcrição e Identificação de Detalhes

Este documento detalha as correções realizadas e planejadas para resolver os problemas de identificação de nomes e detalhes em áudios, conforme reportado nos logs.

## Problemas Identificados

Com base na análise dos logs e do código, identificamos os seguintes problemas principais:

1.  **Falha na Extração de Nomes Compostos:**
    *   **Sintoma:** O bot respondia "Desculpe, não entendi seu nome" para mensagens como "Nicolas Leonardo".
    *   **Causa:** A expressão regular (regex) na função `extractName` assumia que nomes eram palavras únicas sem espaços. Além disso, havia um limite de tamanho de 30 caracteres que rejeitava nomes longos.
    *   **Correção Realizada:** Atualizamos o `name-extractor.ts` para suportar nomes compostos (ex: "Nicolas Leonardo") e nomes completos com preposições (ex: "de", "da", "dos"), e aumentamos o limite para 60 caracteres.

2.  **Prompt do Whisper Limitado:**
    *   **Sintoma:** Transcrições de nomes específicos podiam falhar ou serem imprecisas.
    *   **Causa:** O modelo de tradução (Whisper) não tinha contexto sobre nomes brasileiros comuns compostos ou específicos no prompt de sistema.
    *   **Correção Realizada:** Atualizamos o `audio-transcription.service.ts` para incluir uma lista expandida de nomes brasileiros comuns e compostos no prompt do sistema.

3.  **Fluxo de Recomendação e Preferências (Contexto "Sou Grande"):**
    *   **Sintoma:** O usuário disse "sou grande" mas o bot recomendou um Fiat Strada (carro pequeno).
    *   **Causa:** O sistema de extração de preferências (`preferenceExtractor`) pode não estar capturando explicitamente características físicas ("sou grande") e traduzindo para "evitar compactos" ou "preferir SUVs/Picapes grandes". Este é um problema de lógica de LLM/Extração, separado do problema de transcrição de áudio.
    *   **Ação Recomendada:** Criar uma tarefa separada para refinar o `SYSTEM_PROMPT` do `vehicle-expert.agent.ts` para dar mais peso a restrições físicas mencionadas pelo usuário.

4.  **Falha na Extração de Nome na Saudação ("Meu nome é X"):**
    *   **Sintoma:** O bot respondia com a saudação genérica mesmo quando o usuário dizia "Oi, meu nome é X".
    *   **Causa:** A lógica em `processGreeting` pode ter priorizado a detecção de veículo ou falhado na extração combinada. A melhoria no `extractName` deve resolver a maioria desses casos, pois agora "Meu nome é Nicolas Leonardo" será corretamente identificado como um nome, permitindo que o fluxo `processGreeting` avance para a próxima etapa.

## Resumo das Alterações (Já Aplicadas)

### 1. `src/graph/langgraph/extractors/name-extractor.ts`
*   ** Regex Atualizado:** Suporte para nomes com espaços e preposições (`de`, `da`, `e`, etc.).
*   ** Limite Aumentado:** Aumento do limite de validação de 30 para 60 caracteres.
*   ** Validação Melhorada:** Lógica para validar cada parte de um nome composto.

### 2. `src/services/audio-transcription.service.ts`
*   ** Prompt Enriquecido:** Adição de nomes como "Nicolas", "Leonardo", "Valteriz", "Matheus", "Guilherme", "Felipe" ao prompt de contexto do Whisper.

### 3. `src/agents/preference-extractor.agent.ts`
*   **Regra de Interpretação "Versátil":** Adicionada regra explícita para que pedidos de "carro versátil", "econômico" e "dia a dia" sejam interpretados preferencialmente como "hatch" ou "sedan", evitando a recomendação incorreta de picapes (como Strada) a menos que "carga" ou "trabalho" sejam explicitamente mencionados.
*   **Regra para Pessoas Altas:** Adicionada instrução para interpretar frases como "sou grande" ou "tenho 1,80m" adicionando `espaco_interno` nas prioridades e `hatch_pequeno` nos `dealBreakers`.
*   **Correção de Typos em Modelos:** Adicionada instrução para corrigir erros comuns de transcrição em exclusões, como "Cwid" -> "Kwid", "estrada" -> "Strada" e "Marcas" -> "March".

### 4. `src/graph/langgraph/extractors/name-extractor.ts` e `conversation-flow`
*   **Correção de Loop de Saudação:**
    *   `name-extractor.ts`: Atualizado para remover saudações (ex: "Oi", "Bom dia") do início do nome extraído e retornar `null` se a mensagem for *apenas* uma saudação.
    *   `name-extractor.ts`: Aumentado limite de caracteres para 100 para suportar nomes compostos longos (ex: "Nicolas Leonardo Nepomuceno de Souza Santos").
    *   `langgraph-conversation.ts`: Ajustado para responder apenas com o **primeiro nome** (ex: "Olá, Nicolas!") mesmo que o nome completo tenha sido capturado e salvo no perfil.
    *   `langgraph-conversation.ts`: Removida restrição `!isGreeting` no fluxo de processamento, permitindo que mensagens como "Oi, sou Rafael" sejam processadas corretamente como identificação de nome, eliminando o loop onde o bot perguntava o nome repetidamente.

### 5. `src/agents/vehicle-expert.agent.ts`
*   **Correção de Loop Pós-Recomendação:**
    *   Aprimorada a detecção de continuidade de conversa sobre um veículo já recomendado.
    *   Expandida a Regex de detecção de perguntas para incluir termos como "versão", "motor", "diesel", "turbo", "combustível", "cor", "ano", "câmbio".
    *   O sistema agora detecta menções parciais ao nome do veículo (ex: "Renegade" dá match em "Jeep Renegade Longitude") para evitar reiniciar a busca desnecessariamente.
*   **Aproveitamento de Estado de Financiamento:**
    *   No handler de interesse (`interest.handler.ts`), adicionada verificação se o cliente JÁ mencionou financiamento anteriormente.
    *   Se `wantsFinancing` for verdadeiro no perfil, o bot pula a pergunta genérica ("Financiado ou a vista?") e pergunta direto sobre a entrada ou troca para simulação.

## Próximos Passos (Recomendados)

1.  **Monitorar logs:** Verificar se os erros de "não entendi seu nome" diminuem com essas correções.
2.  **Refinar LLM (Tarefa Futura):** Melhorar a interpretação de restrições como "sou grande" para evitar recomendações de carros compactos.

---
**Status:** Correções de transcrição e nome aplicadas e verificadas via testes. Pronto para deploy/teste em produção.
