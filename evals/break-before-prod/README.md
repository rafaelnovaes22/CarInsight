# Contratos offline

`npm run eval:contracts` executa as funções de produção `DeterministicRankerService.rank`,
`GuardrailsService.validateInput` e `validateOutput`. Só a fronteira Prisma e o logging são
substituídos no teste. Não usa banco, inventário, credenciais ou LLM externos.

As expectativas e o catálogo sintético ficam nos testes versionados. O orçamento também
é verificado no filtro SQL enviado ao Prisma. Testes negativos exigem reprovação de ID
inexistente, preço alterado, ordem errada, orçamento violado, duplicatas e score inválido.
O catálogo não representa anúncios ou especificações de carros reais.

O runner anterior concatenava a resposta esperada ao input e o juiz simulado repetia o
resultado. Esse comportamento e seus 20 casos textuais foram removidos. O relatório atual
contém as asserções efetivamente executadas e falha com erros, testes pulados ou coleta vazia.

`npm run eval:offline` mede apenas a proteção determinística de entrada e produz
`OFFLINE_PASS`, com `productionQualified: false`. CI usa esse modo explicitamente.
`npm run eval` exige as três camadas medidas: entrada (100%), recomendações (70%) e defesa
de papel (100%). Ausência de infraestrutura ou evidência gera `HOLD`, nunca `SHIP`.
`PRODUCTION_QUALIFIED` significa somente aprovação dessa suíte e não autoriza deploy.

Nenhum desses contratos mede taxa geral de alucinação, satisfação do usuário, catálogo vivo
ou custo real por conversa. O job de custo testa um cenário estimado com tokens e câmbio
fixos, registrado no relatório. Avaliação de respostas reais permanece separada e requer
execução explícita com infraestrutura e autorização de custo.
