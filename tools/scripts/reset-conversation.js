/**
 * Script para resetar conversa específica
 * Uso: node reset-conversation.js PHONE_NUMBER
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetConversation(phoneNumber) {
  try {
    console.log(`🔍 Procurando conversa para ${phoneNumber}...`);

    // Buscar conversa
    const conversation = await prisma.conversation.findFirst({
      where: { phoneNumber },
      include: {
        recommendations: true,
        lead: true,
      },
    });

    if (!conversation) {
      console.log('❌ Conversa não encontrada');
      return;
    }

    console.log('📊 Conversa encontrada:');
    console.log(`   - ID: ${conversation.id}`);
    console.log(`   - Step: ${conversation.currentStep}`);
    console.log(`   - Quiz answers: ${conversation.quizAnswers.length}`);
    console.log(`   - Recommendations: ${conversation.recommendations.length}`);
    console.log(`   - Leads: ${conversation.leads.length}`);

    // Deletar dados relacionados
    console.log('\n🗑️  Deletando dados...');

    await prisma.recommendation.deleteMany({
      where: { conversationId: conversation.id },
    });
    console.log('   ✅ Recomendações deletadas');

    await prisma.quizAnswer.deleteMany({
      where: { conversationId: conversation.id },
    });
    console.log('   ✅ Quiz answers deletadas');

    await prisma.lead.deleteMany({
      where: { conversationId: conversation.id },
    });
    console.log('   ✅ Leads deletados');

    await prisma.conversation.delete({
      where: { id: conversation.id },
    });
    console.log('   ✅ Conversa deletada');

    console.log('\n✅ Conversa resetada com sucesso!');
    console.log('📱 Agora envie "oi" novamente no WhatsApp para começar do zero.\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const phoneNumber = process.argv[2] || '5511949105033';
resetConversation(phoneNumber);
