require('dotenv').config();
const axios = require('axios');

async function testSecondNumber() {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  
  // NOVO NÚMERO PARA TESTE
  const newNumber = '5511974149740';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTE COM SEGUNDO NÚMERO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📤 Enviando para:', '+' + newNumber);
  console.log('📱 De:', '+1 555 189 9820 (número teste Meta)');
  console.log('');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: newNumber,
        type: 'text',
        text: {
          body: `🎉 FACILIAUTO - TESTE SEGUNDO NÚMERO\n\n` +
                `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n\n` +
                `Se você recebeu esta mensagem:\n` +
                `✅ O sistema está funcionando!\n\n` +
                `Responda "oi" para testar o bot.`
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅✅✅ SUCESSO! MENSAGEM ENVIADA! ✅✅✅');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 Response da API:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('✅ Message ID:', response.data.messages[0].id);
    console.log('✅ WhatsApp ID:', response.data.contacts[0].wa_id);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 VERIFIQUE O WHATSAPP:');
    console.log('   Número: +55 11 97414-9740');
    console.log('   Remetente: +1 555 189 9820');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⏰ Aguarde até 30 segundos para receber');
    console.log('');
    console.log('Se receber:');
    console.log('  ✅ Sistema funcionando!');
    console.log('  ✅ Pode prosseguir para webhook');
    console.log('');
    console.log('Se NÃO receber:');
    console.log('  ⚠️  Pode ser problema da operadora');
    console.log('  ⚠️  Pode haver delay do Meta');
    console.log('  ⚠️  Verifique se número está correto');
    console.log('');

  } catch (error) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ ERRO AO ENVIAR MENSAGEM');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    if (error.response) {
      const err = error.response.data.error;
      console.log('❌ Status:', error.response.status);
      console.log('❌ Error Code:', err.code);
      console.log('❌ Message:', err.message);
      console.log('');
      
      if (err.code === 131030) {
        console.log('🔴 PROBLEMA: Número NÃO está na lista "Para"');
        console.log('');
        console.log('O número 5511974149740 não foi adicionado ainda!');
        console.log('');
        console.log('SOLUÇÃO:');
        console.log('1. Meta Dashboard → WhatsApp → Primeiros Passos');
        console.log('2. Seção "Para:" → Gerenciar lista');
        console.log('3. Adicionar: 5511974149740');
        console.log('4. Salvar');
        console.log('5. Executar este teste novamente');
        console.log('');
      } else if (err.code === 190) {
        console.log('🔴 PROBLEMA: Token expirado');
        console.log('');
        console.log('Tokens temporários duram 24 horas.');
        console.log('');
        console.log('SOLUÇÃO:');
        console.log('1. Meta Dashboard → WhatsApp → Primeiros Passos');
        console.log('2. Copiar NOVO token de acesso temporário');
        console.log('3. Atualizar .env');
        console.log('4. Testar novamente');
        console.log('');
      } else {
        console.log('Detalhes completos:');
        console.log(JSON.stringify(err, null, 2));
        console.log('');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.log('❌ Timeout - Requisição demorou mais de 20 segundos');
    } else if (error.code === 'ENOTFOUND') {
      console.log('❌ Erro de DNS/Rede');
    } else {
      console.log('❌ Erro:', error.message);
    }
    
    process.exit(1);
  }
}

console.log('⏳ Iniciando teste...\n');
testSecondNumber();
