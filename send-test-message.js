require('dotenv').config();
const axios = require('axios');

async function sendTest() {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  
  // SEU NÚMERO (do Meta Dashboard)
  const yourNumber = '5511949105033';

  console.log('📤 Enviando mensagem para:', yourNumber);
  console.log('📱 Do número de teste Meta:', '+1 555 189 9820');
  console.log('');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: yourNumber,
        type: 'text',
        text: {
          body: `🎉 FACILIAUTO FUNCIONANDO!\n\nData: ${new Date().toLocaleString('pt-BR')}\n\nO bot está pronto! Responda "oi" para testar.`
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
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 VERIFIQUE SEU WHATSAPP AGORA!');
    console.log('   Número: +55 11 94910-5033');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (response.data.messages) {
      console.log('✅ Message ID:', response.data.messages[0].id);
      console.log('');
      console.log('🎯 PRÓXIMOS PASSOS:');
      console.log('1. Você deve receber mensagem do número +1 555 189 9820');
      console.log('2. Responda a mensagem');
      console.log('3. Bot NÃO vai responder ainda (webhook não configurado)');
      console.log('4. Isso é NORMAL! Vamos configurar webhook em seguida.');
      console.log('');
    }

  } catch (error) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ ERRO AO ENVIAR MENSAGEM');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    if (error.response) {
      const err = error.response.data.error;
      console.log('Status:', error.response.status);
      console.log('Error Code:', err.code);
      console.log('Message:', err.message);
      console.log('');
      console.log('Detalhes:');
      console.log(JSON.stringify(err, null, 2));
      console.log('');
      
      if (err.code === 131030) {
        console.log('🔴 PROBLEMA: Número não está na lista "Para"');
        console.log('');
        console.log('Verificar:');
        console.log('1. Meta Dashboard → WhatsApp → Primeiros Passos');
        console.log('2. Seção "Para:" deve mostrar: +55 11 94910-5033');
        console.log('3. Se não estiver, adicione o número');
        console.log('');
      } else if (err.code === 190) {
        console.log('🔴 PROBLEMA: Token expirado');
        console.log('');
        console.log('SOLUÇÃO:');
        console.log('1. Meta Dashboard → WhatsApp → Primeiros Passos');
        console.log('2. Copiar NOVO "Token de acesso temporário"');
        console.log('3. Atualizar .env com novo token');
        console.log('');
      } else if (err.code === 100) {
        console.log('🔴 PROBLEMA: Phone Number ID incorreto');
        console.log('');
        console.log('Phone Number ID atual:', phoneNumberId);
        console.log('');
        console.log('Verificar:');
        console.log('1. Meta Dashboard → WhatsApp → Primeiros Passos');
        console.log('2. Copiar "ID do número de telefone"');
        console.log('3. Deve ser: 897098916813396');
        console.log('');
      } else {
        console.log('🔴 Erro desconhecido. Ver detalhes acima.');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.log('❌ TIMEOUT - Requisição demorou muito');
      console.log('Possível problema de rede/firewall');
    } else if (error.code === 'ENOTFOUND') {
      console.log('❌ Não conseguiu resolver DNS');
      console.log('Problema de rede/conectividade');
    } else {
      console.log('Erro:', error.message);
      console.log('Code:', error.code);
    }
    
    process.exit(1);
  }
}

sendTest();
