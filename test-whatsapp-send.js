require('dotenv').config();
const axios = require('axios');

async function testWhatsApp() {
  console.log('🔍 TESTE META CLOUD API');
  console.log('======================\n');

  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log('❌ Credenciais não configuradas no .env\n');
    console.log('Verifique:');
    console.log('- META_WHATSAPP_TOKEN');
    console.log('- META_WHATSAPP_PHONE_NUMBER_ID');
    process.exit(1);
  }

  console.log('✅ Credenciais encontradas:');
  console.log(`Token: ${token.substring(0, 20)}...`);
  console.log(`Phone Number ID: ${phoneNumberId}\n`);

  // Pedir número do usuário
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Digite seu número de WhatsApp (ex: 5511999999999): ', async (phoneNumber) => {
    readline.close();

    if (!phoneNumber) {
      console.log('❌ Número não fornecido');
      process.exit(1);
    }

    console.log(`\n📱 Enviando mensagem de teste para: +${phoneNumber}...\n`);

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: {
            body: `🎉 FaciliAuto Teste - ${new Date().toLocaleTimeString()}`
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('✅ Mensagem enviada com sucesso!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      console.log('\n📱 Verifique seu WhatsApp agora!\n');

      if (response.data.messages) {
        console.log('Message ID:', response.data.messages[0].id);
      }

    } catch (error) {
      console.log('❌ Erro ao enviar mensagem\n');
      
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Error:', JSON.stringify(error.response.data, null, 2));
        
        const errorData = error.response.data.error;
        
        if (errorData) {
          console.log('\n🔍 Análise do erro:\n');
          
          if (errorData.message.includes('recipient_phone')) {
            console.log('❌ ERRO: Número não está na lista "Para"\n');
            console.log('Solução:');
            console.log('1. Acesse: https://developers.facebook.com/');
            console.log('2. Seu App → WhatsApp → Primeiros Passos');
            console.log('3. Seção "Para" → Adicionar número');
            console.log(`4. Adicione: +${phoneNumber}`);
            console.log('5. Tente novamente\n');
          } else if (errorData.message.includes('access token') || errorData.code === 190) {
            console.log('❌ ERRO: Token inválido ou expirado\n');
            console.log('Tokens temporários duram apenas 24 horas!\n');
            console.log('Solução:');
            console.log('1. Acesse: https://developers.facebook.com/');
            console.log('2. Seu App → WhatsApp → Primeiros Passos');
            console.log('3. Copie o novo "Token de acesso temporário"');
            console.log('4. Atualize o .env com o novo token');
            console.log('5. Tente novamente\n');
          } else {
            console.log('Erro:', errorData.message);
            console.log('Code:', errorData.code);
          }
        }
      } else if (error.request) {
        console.log('❌ Sem resposta do servidor');
        console.log('Possível problema de rede ou firewall');
      } else {
        console.log('Erro:', error.message);
      }
      
      process.exit(1);
    }
  });
}

testWhatsApp();
