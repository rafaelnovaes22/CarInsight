/**
 * Exporta todos os dados do banco para JSON
 * Não requer pg_dump - usa Prisma
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/db-export.mjs
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function exportDatabase() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   EXPORTANDO BANCO DE DADOS');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    // Exportar veículos
    console.log('📦 Exportando veículos...');
    const vehicles = await prisma.vehicle.findMany();
    console.log(`   ✅ ${vehicles.length} veículos`);

    // Exportar conversas
    console.log('📦 Exportando conversas...');
    const conversations = await prisma.conversation.findMany();
    console.log(`   ✅ ${conversations.length} conversas`);

    // Exportar mensagens
    console.log('📦 Exportando mensagens...');
    const messages = await prisma.message.findMany();
    console.log(`   ✅ ${messages.length} mensagens`);

    // Exportar leads
    console.log('📦 Exportando leads...');
    let leads = [];
    try {
      leads = await prisma.lead.findMany();
      console.log(`   ✅ ${leads.length} leads`);
    } catch (e) {
      console.log('   ⚠️  Tabela Lead não existe');
    }

    // Criar objeto de backup
    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        vehicles,
        conversations,
        messages,
        leads,
      },
      counts: {
        vehicles: vehicles.length,
        conversations: conversations.length,
        messages: messages.length,
        leads: leads.length,
      },
    };

    // Salvar arquivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `scripts/db-backup-${timestamp}.json`;

    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`   ✅ BACKUP SALVO: ${filename}`);
    console.log('════════════════════════════════════════════════════════════');

    // Mostrar resumo
    console.log('\n📊 Resumo:');
    console.log(`   Veículos: ${vehicles.length}`);
    console.log(`   Conversas: ${conversations.length}`);
    console.log(`   Mensagens: ${messages.length}`);
    console.log(`   Leads: ${leads.length}`);

    // Mostrar categorias de veículos
    const byCategory = vehicles.reduce((acc, v) => {
      acc[v.carroceria || 'N/I'] = (acc[v.carroceria || 'N/I'] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Veículos por categoria:');
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });

    return filename;
  } catch (error) {
    console.error('\n❌ Erro ao exportar:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportDatabase().catch(console.error);
