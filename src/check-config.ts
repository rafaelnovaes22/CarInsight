import { env } from './config/env';
import axios from 'axios';
import { logger } from './lib/logger';

async function checkWhatsAppConfig() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📱 Verificando Configuração WhatsApp Meta API');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check env vars
  console.log('✅ Configuração no .env:');
  console.log(`   META_WHATSAPP_TOKEN: ${env.META_WHATSAPP_TOKEN ? '✅ Definido' : '❌ Faltando'}`);
  console.log(`   META_WHATSAPP_PHONE_NUMBER_ID: ${env.META_WHATSAPP_PHONE_NUMBER_ID ? '✅ Definido' : '❌ Faltando'}`);
  console.log(`   META_WHATSAPP_BUSINESS_ACCOUNT_ID: ${env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ? '✅ Definido' : '❌ Faltando'}`);
  console.log(`   META_WEBHOOK_VERIFY_TOKEN: ${env.META_WEBHOOK_VERIFY_TOKEN ? '✅ Definido' : '❌ Faltando'}`);
  
  if (!env.META_WHATSAPP_TOKEN || !env.META_WHATSAPP_PHONE_NUMBER_ID) {
    console.log('\n❌ Credenciais incompletas!');
    process.exit(1);
  }
  
  console.log('\n✅ Testando API do Meta...\n');
  
  try {
    // Get phone number info
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${env.META_WHATSAPP_PHONE_NUMBER_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${env.META_WHATSAPP_TOKEN}`,
        },
      }
    );
    
    console.log('✅ Phone Number Info:');
    console.log(`   Número: ${response.data.display_phone_number || 'N/A'}`);
    console.log(`   Verified Name: ${response.data.verified_name || 'N/A'}`);
    console.log(`   Quality Rating: ${response.data.quality_rating || 'N/A'}`);
    console.log(`   Status: ${response.data.status || 'N/A'}`);
    
    console.log('\n✅ WhatsApp API está configurada corretamente!');
    console.log('\nPróximos passos:');
    console.log('1. Verifique se o número 5511949105033 está na lista de teste em: https://developers.facebook.com/apps');
    console.log('2. Na seção "WhatsApp > API Setup", adicione o número como "Test Recipient"');
    console.log('3. Aguarde a ativação (pode levar até 10 minutos)');
    
  } catch (error: any) {
    console.log('\n❌ Erro ao conectar com Meta API:');
    console.log(`   Erro: ${error.response?.data?.error?.message || error.message}`);
    console.log('\nPossíveis causas:');
    console.log('• Token inválido ou expirado');
    console.log('• Phone Number ID incorreto');
    console.log('• App não tem permissão para WhatsApp');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkWhatsAppConfig().catch(error => {
  console.error('Erro:', error);
  process.exit(1);
});