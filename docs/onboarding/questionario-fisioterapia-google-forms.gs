/**
 * Gera o "Questionário — Assistente Virtual para Fisioterapia Respiratória"
 * no Google Forms.
 *
 * COMO USAR:
 * 1. Acesse https://script.google.com → Novo projeto
 * 2. Cole TODO este conteúdo, substituindo o código padrão
 * 3. Salve e clique em "Executar" (função criarFormulario)
 * 4. Autorize o acesso quando solicitado
 * 5. O link de edição e o link público aparecem no Log (Ver → Registros)
 */
function criarFormulario() {
  const form = FormApp.create('Questionário — Assistente Virtual para Fisioterapia Respiratória');
  form.setDescription(
    'Para criarmos o assistente de WhatsApp ideal para a sua clínica, precisamos conhecer um pouco do seu trabalho. ' +
      'São poucos minutos. Quanto mais claro, melhor o resultado.'
  );
  form.setCollectEmail(true);
  form.setProgressBar(true);

  // ---------------------------------------------------------------- Seção 1
  form.addSectionHeaderItem().setTitle('1. Sua clínica');
  form.addTextItem().setTitle('Nome da clínica/profissional').setRequired(true);
  form.addTextItem().setTitle('Responsável técnico (nome + CREFITO)').setRequired(true);
  form.addTextItem().setTitle('Cidade/região de atuação').setRequired(true);
  form.addTextItem().setTitle('Site, Instagram e redes sociais');
  form.addParagraphTextItem().setTitle('Contato do projeto (nome / e-mail / telefone)').setRequired(true);
  form
    .addCheckboxItem()
    .setTitle('Atende em')
    .setChoiceValues(['Clínica', 'Domicílio (home care)', 'Hospital', 'Online / telefisioterapia']);

  // ---------------------------------------------------------------- Seção 2
  form.addPageBreakItem().setTitle('2. Seus serviços');
  form
    .addParagraphTextItem()
    .setTitle('Descreva em uma frase o foco do seu atendimento')
    .setHelpText('Ex: reabilitação respiratória pós-COVID, DPOC, pediátrico, pós-operatório')
    .setRequired(true);
  form
    .addCheckboxItem()
    .setTitle('Quais públicos você atende?')
    .showOtherOption(true)
    .setChoiceValues(['Pediátrico', 'Adulto', 'Idoso', 'Pós-cirúrgico', 'Neurológico']);
  form
    .addParagraphTextItem()
    .setTitle('Principais serviços oferecidos (liste até 5)')
    .setHelpText('Ex: avaliação respiratória, sessões de reabilitação, fisioterapia hospitalar, home care, aluguel de equipamento');
  form.addTextItem().setTitle('Valor da avaliação (R$)');
  form.addTextItem().setTitle('Valor da sessão avulsa (R$)');
  form.addTextItem().setTitle('Pacotes / pacotes promocionais');
  form
    .addMultipleChoiceItem()
    .setTitle('Atende convênios?')
    .showOtherOption(true)
    .setChoiceValues(['Não, só particular', 'Sim (especifique em "Outro")']);
  form
    .addCheckboxItem()
    .setTitle('Formas de pagamento')
    .setChoiceValues(['Pix / dinheiro', 'Cartão', 'Parcelamento', 'Reembolso convênio']);

  // ---------------------------------------------------------------- Seção 3
  form.addPageBreakItem().setTitle('3. Atendimento hoje');
  form.addTextItem().setTitle('Número de WhatsApp que será usado pelo assistente').setRequired(true);
  form
    .addParagraphTextItem()
    .setTitle('Horário de atendimento')
    .setHelpText('Ex: Seg–Sex 8h–18h · Sáb 8h–12h · Dom: não atende');
  form.addTextItem().setTitle('Mensagens/agendamentos recebidos por dia (estimativa)');
  form
    .addParagraphTextItem()
    .setTitle('Maior dificuldade no atendimento atual')
    .setHelpText('Ex: demora pra responder, faltas/no-show, perda de contatos fora do horário');
  form
    .addMultipleChoiceItem()
    .setTitle('Usa agenda/sistema?')
    .showOtherOption(true)
    .setChoiceValues(['Não', 'Sim (especifique em "Outro")']);

  // ---------------------------------------------------------------- Seção 4
  form.addPageBreakItem().setTitle('4. Como o assistente deve falar');
  form
    .addMultipleChoiceItem()
    .setTitle('Nome do assistente')
    .showOtherOption(true)
    .setChoiceValues(['Queremos sugestão da NovAIs', 'Já temos um nome (informe em "Outro")']);
  form
    .addMultipleChoiceItem()
    .setTitle('Gênero do assistente')
    .setChoiceValues(['Masculino', 'Feminino', 'Neutro']);
  form
    .addCheckboxItem()
    .setTitle('Tom de voz')
    .setChoiceValues(['Acolhedor', 'Profissional', 'Consultivo', 'Direto']);
  form
    .addMultipleChoiceItem()
    .setTitle('Pode usar emojis?')
    .setChoiceValues(['Não', 'Pouco', 'Moderado']);
  form
    .addParagraphTextItem()
    .setTitle('O assistente NUNCA deve...')
    .setHelpText('Ex: dar diagnóstico, prescrever exercício sem avaliação, prometer cura, opinar sobre conduta médica');

  // ---------------------------------------------------------------- Seção 5
  form.addPageBreakItem().setTitle('5. O que o assistente deve fazer');
  form
    .addCheckboxItem()
    .setTitle('Objetivo principal')
    .setChoiceValues([
      'Agendar avaliação/sessão',
      'Tirar dúvidas',
      'Captar pacientes',
      'Confirmar/remarcar consultas',
      'Acompanhamento pós-alta',
    ]);
  form
    .addParagraphTextItem()
    .setTitle('Perguntas que o assistente DEVE fazer ao paciente')
    .setHelpText('Ex: nome, queixa/encaminhamento, idade, convênio, região');
  form
    .addMultipleChoiceItem()
    .setTitle('Precisa de encaminhamento/pedido médico para atender?')
    .setChoiceValues(['Sim', 'Não', 'Depende']);
  form
    .addParagraphTextItem()
    .setTitle('Quando o assistente deve transferir para um humano?')
    .setHelpText('Ex: caso clínico complexo, urgência, reclamação, negociação de pacote');
  form.addTextItem().setTitle('Para quem transferir (nome / WhatsApp)');

  // ---------------------------------------------------------------- Seção 6
  form.addPageBreakItem().setTitle('6. Perguntas frequentes').setHelpText(
    'As dúvidas que seus pacientes mais mandam — e como o assistente deve responder.'
  );
  [
    'Vocês atendem meu convênio?',
    'Quanto custa a avaliação/sessão?',
    'Precisa de pedido médico?',
    'Atendem em casa?',
    'Como funciona o tratamento?',
  ].forEach((pergunta) => {
    form.addParagraphTextItem().setTitle('Resposta ideal — "' + pergunta + '"');
  });

  // ---------------------------------------------------------------- Seção 7
  form.addPageBreakItem().setTitle('7. Catálogo e dados');
  form
    .addMultipleChoiceItem()
    .setTitle('Como vai nos enviar serviços, valores e agenda?')
    .showOtherOption(true)
    .setChoiceValues(['Planilha', 'Sistema / agenda online', 'Cadastro manual']);
  form
    .addMultipleChoiceItem()
    .setTitle('O assistente deve informar que é uma IA?')
    .setChoiceValues(['Sim (recomendado)', 'Não']);
  form
    .addParagraphTextItem()
    .setTitle('Mensagem de consentimento (LGPD) para coletar dados do paciente')
    .setHelpText('Atenção: dados de saúde são sensíveis e exigem consentimento explícito.');

  // ---------------------------------------------------------------- Seção 8
  form.addPageBreakItem().setTitle('8. Pós-atendimento (opcional)');
  form
    .addMultipleChoiceItem()
    .setTitle('Deseja ativar acompanhamento automático do paciente?')
    .setChoiceValues(['Sim', 'Não']);
  form
    .addCheckboxItem()
    .setTitle('Lembretes úteis')
    .setChoiceValues([
      'Confirmação de sessão',
      'Reagendamento de faltas',
      'Exercícios/cuidados em casa',
      'Retorno periódico',
    ]);
  form
    .addTextItem()
    .setTitle('Programa de indicação — benefício para quem indicar')
    .setHelpText('Ex: sessão de bônus, desconto no pacote');

  // ---------------------------------------------------------------- Confirmação
  form.setConfirmationMessage(
    'Pronto! Ao receber suas respostas, agendamos uma conversa rápida de alinhamento e começamos a montar o seu assistente. Dúvidas? Fale com seu consultor NovAIs.'
  );

  Logger.log('Link de edição: ' + form.getEditUrl());
  Logger.log('Link público (enviar ao cliente): ' + form.getPublishedUrl());
}
