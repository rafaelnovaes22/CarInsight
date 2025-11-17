require('dotenv').config();
const axios = require('axios');

async function testWithMetaNumber() {
  console.log('🎯 TESTE COM NÚMERO DO META');
  console.log('==========================\n');

  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  console.log('✅ Credenciais:');
  console.log(`Token: ${token.substring(0, 20)}...`);
  console.log(`Phone Number ID: ${phoneNumberId}\n`);

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📱 IMPORTANTE:');
  console.log('1. Acesse: https://developers.facebook.com/');
  console.log('2. Seu App → WhatsApp → Primeiros Passos');
  console.log('3. Na seção "Para:", adicione SEU número pessoal');
  console.log('   Exemplo: 5511999999999\n');

  readline.question('Digite SEU número de WhatsApp para receber a mensagem: ', async (yourNumber) => {
    console.log(`\n📤 O NÚMERO DO META vai enviar mensagem para: +${yourNumber}\n`);
    console.log('⏳ Enviando...\n');

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: yourNumber,
          type: 'text',
          text: {
            body: `🎉 FaciliAuto funcionando! Teste: ${new Date().toLocaleTimeString()}\n\nResponda esta mensagem para iniciar o bot!`
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

      console.log('✅ SUCESSO! Mensagem enviada!\n');
      console.log('📱 Verifique seu WhatsApp AGORA!\n');
      console.log('Detalhes:');
      console.log(JSON.stringify(response.data, null, 2));
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎯 Próximo passo:');
      console.log('Responda a mensagem no WhatsApp para testar o bot!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
      console.log('❌ ERRO ao enviar\n');
      
      if (error.response) {
        const errorData = error.response.data.error;
        console.log('Status:', error.response.status);
        console.log('Error:', JSON.stringify(errorData, null, 2));
        console.log('\n🔍 ANÁLISE:\n');
        
        if (errorData.code === 131030) {
          console.log('❌ Seu número NÃO está na lista "Para"\n');
          console.log('SOLUÇÃO:');
          console.log('1. Acesse: https://developers.facebook.com/');
          console.log('2. Seu App → WhatsApp → Primeiros Passos');
          console.log('3. Seção "Para:" → Clicar em "Gerenciar"');
          console.log(`4. Adicionar: +${yourNumber}`);
          console.log('5. Salvar e testar novamente\n');
        } else if (errorData.code === 190) {
          console.log('❌ Token EXPIRADO (tokens temporários duram 24h)\n');
          console.log('SOLUÇÃO:');
          console.log('1. Acesse: https://developers.facebook.com/');
          console.log('2. Seu App → WhatsApp → Primeiros Passos');
          console.log('3. Copiar NOVO "Token de acesso temporário"');
          console.log('4. Atualizar .env com novo token');
          console.log('5. Testar novamente\n');
        } else if (errorData.code === 100) {
          console.log('❌ Phone Number ID INCORRETO\n');
          console.log('SOLUÇÃO:');
          console.log('1. Acesse: https://developers.facebook.com/');
          console.log('2. Seu App → WhatsApp → Primeiros Passos');
          console.log('3. Copiar "ID do número de telefone"');
          console.log('4. Atualizar .env');
          console.log('5. Testar novamente\n');
        } else {
          console.log('Código do erro:', errorData.code);
          console.log('Mensagem:', errorData.message);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.log('❌ Timeout - requisição demorou muito');
        console.log('Possível problema de rede ou firewall');
      } else {
        console.log('Erro:', error.message);
      }
    }
    
    readline.close();
  });
}

testWithMetaNumber();
