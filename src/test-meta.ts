import { WhatsAppMetaService } from './services/whatsapp-meta.service';
import { logger } from './lib/logger';

async function testMetaAPI() {
  logger.info('📱 Testing Meta Cloud API connection...');
  
  const whatsapp = new WhatsAppMetaService();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📞 WhatsApp Business API Test');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Test the connection by sending a simple text message
    // Use your test phone number (with country code, e.g., 5511999999999)
    const testPhone = process.argv[2] || '5511999999999';
    
    console.log(`Testing with phone: ${testPhone}\n`);
    
    await whatsapp.sendMessage(testPhone, '🧪 Teste de conexão Meta Cloud API\n\nSe você recebeu esta mensagem, a integração está funcionando! ✅');
    
    console.log('✅ SUCCESS! Message sent via WhatsApp Meta API!');
    console.log('\nYour WhatsApp number should receive a test message shortly.');
    console.log('\nNext steps:');
    console.log('1. Check your WhatsApp for the test message');
    console.log('2. Reply to the message to test the webhook');
    console.log('3. Run: npm run dev:whatsapp to start the webhook server');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ ERROR sending WhatsApp message:');
    console.error('\nError details:', error.message);
    
    if (error.response?.data) {
      console.error('\nAPI Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('\nTroubleshooting:');
    console.error('1. Verify your META_WHATSAPP_TOKEN is correct');
    console.error('2. Verify your META_WHATSAPP_PHONE_NUMBER_ID is correct');
    console.error('3. Verify the phone number has country code (e.g., 5511...)');
    console.error('4. Check Meta Developers dashboard for errors');
    
    process.exit(1);
  }
}

// Run test
testMetaAPI().catch(error => {
  logger.error({ error }, '❌ Meta API test failed');
  process.exit(1);
});