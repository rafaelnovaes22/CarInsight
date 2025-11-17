require('dotenv').config();
const axios = require('axios');

async function testFinal() {
  console.log('🎉 TESTE FINAL - APP ATIVO');
  console.log('==========================\n');

  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  console.log('✅ Token:', token.substring(0, 30) + '...');
  console.log('✅ Phone ID:', phoneNumberId);
  console.log('');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Digite seu número de WhatsApp (ex: 5511999999999): ', async (phoneNumber) => {
    readline.close();

    console.log(`\n📤 Enviando mensagem para: +${phoneNumber}...\n`);

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: `✅ FACILIAUTO ATIVO! ${new Date().toLocaleTimeString()}\n\nSeu app Meta está funcionando!\n\nResponda "oi" para testar o bot.`
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅✅✅ SUCESSO! MENSAGEM ENVIADA! ✅✅✅');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('Response:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 VERIFIQUE SEU WHATSAPP AGORA!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (response.data.messages) {
        console.log('✅ Message ID:', response.data.messages[0].id);
        console.log('');
        console.log('🎯 PRÓXIMO PASSO:');
        console.log('Agora vamos configurar o WEBHOOK para o bot responder!');
        console.log('');
      }

    } catch (error) {
      console.log('❌ ERRO\n');
      
      if (error.response) {
        const err = error.response.data.error;
        console.log('Status:', error.response.status);
        console.log('Error:', JSON.stringify(err, null, 2));
        console.log('');
        
        if (err.code === 131030) {
          console.log('🔴 Número não está na lista "Para"');
          console.log(`Adicione +${phoneNumber} no Meta Dashboard`);
        } else if (err.code === 190) {
          console.log('🔴 Token expirado! Gere um novo no Meta Dashboard');
        } else {
          console.log('🔴 Erro:', err.message);
        }
      } else {
        console.log('Erro:', error.message);
      }
    }
  });
}

testFinal();
