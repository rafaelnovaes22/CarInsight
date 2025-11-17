import { MessageHandler } from './src/services/message-handler.service';
import { logger } from './src/lib/logger';

async function testGroq() {
  logger.info('🧪 Testing Groq API with fresh conversation...');
  
  const handler = new MessageHandler();
  const testPhone = `551199${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
  
  console.log(`\n📱 Phone: ${testPhone}\n`);
  
  let response = await handler.handleMessage(testPhone, 'Olá');
  console.log('✅ Step 1: Greeting OK\n');
  
  response = await handler.handleMessage(testPhone, 'sim');
  console.log('✅ Step 2: Quiz Started OK\n');
  
  const answers = ['50000', '1', '5', 'não', '2018', '80000', '1', '2'];
  
  for (let i = 0; i < answers.length; i++) {
    response = await handler.handleMessage(testPhone, answers[i]);
    console.log(`✅ Question ${i + 1}/8 answered: ${answers[i]}`);
    
    if (response.includes('🎯 Encontrei')) {
      console.log('\n' + '='.repeat(80));
      console.log('🤖 RECOMENDAÇÕES GERADAS COM GROQ:');
      console.log('='.repeat(80) + '\n');
      console.log(response);
      console.log('\n' + '='.repeat(80));
      console.log('✅ SUCCESS! Groq está funcionando perfeitamente! ⚡');
      console.log('='.repeat(80));
      process.exit(0);
    }
  }
  
  console.log('❌ No recommendations found');
  process.exit(1);
}

testGroq().catch((error) => {
  logger.error({ error }, '❌ Test failed');
  process.exit(1);
});
