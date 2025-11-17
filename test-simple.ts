import { MessageHandler } from './src/services/message-handler.service';
import { logger } from './src/lib/logger';

async function testSimple() {
  logger.info('🧪 Starting simple test...');
  
  const handler = new MessageHandler();
  const testPhone = '5511888888888';
  
  // Test 1: Greeting
  console.log('\n👤 User: Olá');
  let response = await handler.handleMessage(testPhone, 'Olá');
  console.log('🤖 Bot:', response);
  
  // Test 2: Start quiz
  console.log('\n👤 User: sim');
  response = await handler.handleMessage(testPhone, 'sim');
  console.log('🤖 Bot:', response);
  
  // Test 3: Complete quiz with valid answers
  const answers = ['50000', '1', '5', 'não', '2018', '80000', '2', '2'];
  
  for (const answer of answers) {
    console.log(`\n👤 User: ${answer}`);
    response = await handler.handleMessage(testPhone, answer);
    console.log('🤖 Bot:', response);
    
    // Check if recommendations were shown
    if (response.includes('🎯 Encontrei')) {
      console.log('\n✅ SUCCESS! Recommendations shown!');
      break;
    }
  }
  
  logger.info('✅ Test completed!');
  process.exit(0);
}

testSimple().catch((error) => {
  logger.error({ error }, '❌ Test failed');
  process.exit(1);
});
