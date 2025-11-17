import { MessageHandler } from './services/message-handler.service';
import { logger } from './lib/logger';

// Test script to simulate bot conversation without WhatsApp
async function testBot() {
  logger.info('🧪 Starting bot test...');
  
  const handler = new MessageHandler();
  const testPhone = '5511999999999';
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Test 1: Greeting
  console.log('👤 User: Olá, quero comprar um carro');
  let response = await handler.handleMessage(testPhone, 'Olá, quero comprar um carro');
  console.log('🤖 Bot:', response);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Test 2: Start quiz
  console.log('👤 User: sim');
  response = await handler.handleMessage(testPhone, 'sim');
  console.log('🤖 Bot:', response);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Test 3: Answer quiz questions
  const answers = ['50000', '1', '5', 'não', '2018', '80000', '2', '2'];
  
  for (let i = 0; i < answers.length; i++) {
    console.log(`👤 User: ${answers[i]}`);
    response = await handler.handleMessage(testPhone, answers[i]);
    console.log('🤖 Bot:', response);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  logger.info('✅ Bot test completed!');
  process.exit(0);
}

// Run test
testBot().catch((error) => {
  logger.error({ error }, '❌ Test failed');
  process.exit(1);
});
