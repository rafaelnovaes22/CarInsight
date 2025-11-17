import { MessageHandler } from './src/services/message-handler.service';
import { logger } from './src/lib/logger';

async function testComplete() {
  logger.info('🧪 Starting complete test with Groq...');
  
  const handler = new MessageHandler();
  const testPhone = '5511777777777';
  
  console.log('\n👤 User: Olá, quero comprar um carro');
  let response = await handler.handleMessage(testPhone, 'Olá, quero comprar um carro');
  console.log('🤖 Bot:', response.substring(0, 200) + '...\n');
  
  console.log('👤 User: sim');
  response = await handler.handleMessage(testPhone, 'sim');
  console.log('🤖 Bot:', response.substring(0, 150) + '...\n');
  
  const answers = ['50000', '1', '5', 'não', '2018', '80000', '1', '2'];
  
  for (let i = 0; i < answers.length; i++) {
    console.log(`👤 User: ${answers[i]}`);
    response = await handler.handleMessage(testPhone, answers[i]);
    
    if (response.includes('🎯 Encontrei')) {
      console.log('\n🤖 Bot (RECOMENDAÇÕES):');
      console.log(response);
      console.log('\n✅ SUCCESS! Groq API funcionando perfeitamente!');
      break;
    } else {
      console.log('🤖 Bot:', response.substring(0, 100) + '...\n');
    }
  }
  
  process.exit(0);
}

testComplete().catch((error) => {
  logger.error({ error }, '❌ Test failed');
  process.exit(1);
});
