/**
 * Script para resetar conversas do WhatsApp
 * Prepara o sistema para iniciar o modo conversacional
 * 
 * Uso:
 * npx tsx scripts/reset-conversations.ts [phoneNumber]
 * npx tsx scripts/reset-conversations.ts --all
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetConversation(phoneNumber: string) {
  console.log(`\n🗑️  Resetando conversa de ${phoneNumber}...`);

  try {
    // Buscar conversa
    const conversation = await prisma.conversation.findFirst({
      where: { phoneNumber },
      include: {
        recommendations: true,
        lead: true,
        events: true,
        messages: true
      }
    });

    if (!conversation) {
      console.log(`⚠️  Nenhuma conversa encontrada para ${phoneNumber}`);
      return false;
    }

    console.log(`📊 Conversa encontrada:`);
    console.log(`   - ID: ${conversation.id}`);
    console.log(`   - Step: ${conversation.currentStep}`);
    console.log(`   - Status: ${conversation.status}`);
    console.log(`   - Quiz answers: ${conversation.quizAnswers ? 'Sim' : 'Não'}`);
    console.log(`   - Recommendations: ${conversation.recommendations.length}`);
    console.log(`   - Events: ${conversation.events.length}`);
    console.log(`   - Messages: ${conversation.messages.length}`);
    console.log(`   - Lead: ${conversation.lead ? 'Sim' : 'Não'}`);

    // Deletar em cascata
    await prisma.conversation.delete({
      where: { id: conversation.id }
    });

    console.log(`✅ Conversa resetada com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao resetar conversa:`, error);
    return false;
  }
}

async function resetAllConversations() {
  console.log(`\n🗑️  Resetando TODAS as conversas...`);

  try {
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        phoneNumber: true,
        currentStep: true
      }
    });

    console.log(`📊 Encontradas ${conversations.length} conversas`);

    if (conversations.length === 0) {
      console.log(`⚠️  Nenhuma conversa para resetar`);
      return;
    }

    // Mostrar conversas
    console.log('\nConversas que serão deletadas:');
    conversations.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. ${conv.phoneNumber} (${conv.currentStep})`);
    });

    // Deletar dependências primeiro para evitar erro de Foreign Key
    console.log('   - Deletando Mensagens...');
    await prisma.message.deleteMany({});

    console.log('   - Deletando Recomendações...');
    await prisma.recommendation.deleteMany({});

    console.log('   - Deletando Leads...');
    await prisma.lead.deleteMany({});

    // Tentar deletar eventos se o model existir (AnalyticsEvent ou Event)
    // Assumindo que o erro principal era Lead, vamos prosseguir.

    // Deletar todas
    const result = await prisma.conversation.deleteMany({});

    console.log(`\n✅ ${result.count} conversa(s) deletada(s)!`);
  } catch (error) {
    console.error(`❌ Erro ao resetar conversas:`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);

  console.log('🔄 Reset de Conversas - FaciliAuto WhatsApp');
  console.log('━'.repeat(50));

  if (args.length === 0) {
    console.log('\n❌ Uso incorreto!');
    console.log('\nOpções:');
    console.log('  npx tsx scripts/reset-conversations.ts <phoneNumber>');
    console.log('  npx tsx scripts/reset-conversations.ts --all');
    console.log('\nExemplos:');
    console.log('  npx tsx scripts/reset-conversations.ts 5511949105033');
    console.log('  npx tsx scripts/reset-conversations.ts --all');
    process.exit(1);
  }

  if (args[0] === '--all') {
    await resetAllConversations();
  } else {
    const phoneNumber = args[0];
    await resetConversation(phoneNumber);
  }

  console.log('\n📱 Próximo passo:');
  console.log('   Envie "oi" no WhatsApp para começar uma nova conversa!');
  console.log('\n💡 Modo conversacional:');
  console.log('   Configure ENABLE_CONVERSATIONAL_MODE=true no .env');
  console.log('   Configure CONVERSATIONAL_ROLLOUT_PERCENTAGE=100 para testar\n');

  await prisma.$disconnect();
}

main().catch(console.error);
