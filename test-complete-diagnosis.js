require('dotenv').config();
const axios = require('axios');

async function completeDiagnosis() {
  console.log('🔍 DIAGNÓSTICO COMPLETO META CLOUD API');
  console.log('=====================================\n');

  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  console.log('PASSO 1: Verificar Credenciais');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (!token) {
    console.log('❌ META_WHATSAPP_TOKEN não encontrado\n');
    process.exit(1);
  }
  
  if (!phoneNumberId) {
    console.log('❌ META_WHATSAPP_PHONE_NUMBER_ID não encontrado\n');
    process.exit(1);
  }

  console.log('✅ Token:', token.substring(0, 25) + '...');
  console.log('✅ Phone Number ID:', phoneNumberId);
  console.log('✅ Token length:', token.length, 'chars\n');

  console.log('PASSO 2: Testar Token (verificar se é válido)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log('Consultando informações do número...\n');
    
    const phoneInfo = await axios.get(
      `https://graph.facebook.com/v18.0/${phoneNumberId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 15000
      }
    );

    console.log('✅ Token VÁLIDO!');
    console.log('📱 Informações do número:');
    console.log(JSON.stringify(phoneInfo.data, null, 2));
    console.log('');

  } catch (error) {
    if (error.response) {
      console.log('❌ ERRO ao validar token\n');
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.data.error?.code === 190) {
        console.log('\n🔴 TOKEN EXPIRADO!\n');
        console.log('Tokens temporários duram apenas 24 horas.');
        console.log('\nSOLUÇÃO:');
        console.log('1. Acesse: https://developers.facebook.com/apps/');
        console.log('2. Seu App → WhatsApp → Primeiros Passos');
        console.log('3. Copie o NOVO "Token de acesso temporário"');
        console.log('4. Atualize o .env:\n');
        console.log('   nano .env');
        console.log('   # Substituir META_WHATSAPP_TOKEN="novo_token_aqui"\n');
        process.exit(1);
      }
      
      if (error.response.data.error?.code === 100) {
        console.log('\n🔴 PHONE NUMBER ID INCORRETO!\n');
        console.log('SOLUÇÃO:');
        console.log('1. Acesse: https://developers.facebook.com/apps/');
        console.log('2. Seu App → WhatsApp → Primeiros Passos');
        console.log('3. Copie o "ID do número de telefone" (número grande)');
        console.log('4. Atualize o .env\n');
        process.exit(1);
      }
      
      process.exit(1);
    } else if (error.code === 'ECONNABORTED') {
      console.log('❌ TIMEOUT - Problema de rede\n');
      console.log('Possível firewall ou proxy bloqueando');
      process.exit(1);
    } else {
      console.log('❌ Erro:', error.message);
      process.exit(1);
    }
  }

  console.log('PASSO 3: Verificar número autorizado');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  IMPORTANTE:');
  console.log('Você ADICIONOU seu número na lista "Para"?\n');
  console.log('Como verificar:');
  console.log('1. Acesse: https://developers.facebook.com/apps/');
  console.log('2. Seu App → WhatsApp → Primeiros Passos');
  console.log('3. Procure seção "Para:" (deve estar visível)');
  console.log('4. Seu número deve aparecer na lista\n');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Seu número está na lista "Para"? (sim/não): ', async (answer) => {
    if (answer.toLowerCase() !== 'sim') {
      console.log('\n❌ Por favor, adicione seu número primeiro!\n');
      console.log('Passos:');
      console.log('1. https://developers.facebook.com/apps/');
      console.log('2. Seu App → WhatsApp → Primeiros Passos');
      console.log('3. Seção "Para:" → Clicar botão "Gerenciar"');
      console.log('4. Adicionar seu número: 5511999999999');
      console.log('5. Salvar e executar este teste novamente\n');
      readline.close();
      process.exit(1);
    }

    readline.question('\nDigite seu número de WhatsApp (ex: 5511999999999): ', async (phoneNumber) => {
      readline.close();

      console.log('\n');
      console.log('PASSO 4: Enviar Mensagem de Teste');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Enviando para: +${phoneNumber}...\n`);

      try {
        const response = await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: {
              body: `✅ TESTE FACILIAUTO ${new Date().toLocaleTimeString()}\n\nSe você recebeu esta mensagem, o sistema está funcionando!\n\nResponda "oi" para testar.`
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

        console.log('✅✅✅ SUCESSO! MENSAGEM ENVIADA! ✅✅✅\n');
        console.log('Response:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📱 VERIFIQUE SEU WHATSAPP AGORA!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\nSe não recebeu:');
        console.log('- Verifique se o número está correto');
        console.log('- Confirme que está na lista "Para" no Meta');
        console.log('- Aguarde até 30 segundos\n');

      } catch (error) {
        console.log('❌ ERRO AO ENVIAR MENSAGEM\n');
        
        if (error.response) {
          const err = error.response.data.error;
          console.log('Status:', error.response.status);
          console.log('Error code:', err.code);
          console.log('Message:', err.message);
          console.log('\nDetalhes completos:');
          console.log(JSON.stringify(err, null, 2));
          
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          if (err.code === 131030) {
            console.log('🔴 PROBLEMA: Número não autorizado\n');
            console.log(`O número +${phoneNumber} NÃO está na lista "Para"\n`);
            console.log('SOLUÇÃO DETALHADA:');
            console.log('1. Abra: https://developers.facebook.com/apps/');
            console.log('2. Clique no seu app');
            console.log('3. Menu lateral → WhatsApp → Primeiros Passos');
            console.log('4. Role a página até ver "Para:"');
            console.log('5. Clique em "Gerenciar lista de números de telefone"');
            console.log('6. Clique em "+ Adicionar número de telefone"');
            console.log(`7. Digite: ${phoneNumber} (sem + ou espaços)`);
            console.log('8. Clicar em "Adicionar"');
            console.log('9. Aguardar confirmação');
            console.log('10. Executar este teste novamente\n');
          }
        } else {
          console.log('Erro de conexão:', error.message);
        }
      }
    });
  });
}

completeDiagnosis();
