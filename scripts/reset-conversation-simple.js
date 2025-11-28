const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetConversation(phoneNumber) {
  try {
    console.log(`🗑️  Deletando conversa de ${phoneNumber}...`);
    
    const result = await prisma.conversation.deleteMany({
      where: { phoneNumber }
    });

    console.log(`✅ ${result.count} conversa(s) deletada(s)`);
    console.log('\n📱 Agora envie "oi" no WhatsApp para começar do zero!\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const phoneNumber = process.argv[2] || '5511949105033';
resetConversation(phoneNumber);
