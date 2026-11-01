/**
 * Importa dados de um backup JSON para o banco
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/db-import.mjs scripts/db-backup-XXXX.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function importDatabase(backupFile) {
  console.log('════════════════════════════════════════════════════════════');
  console.log('   IMPORTANDO BANCO DE DADOS');
  console.log('════════════════════════════════════════════════════════════\n');

  if (!backupFile) {
    console.error('❌ Uso: node scripts/db-import.mjs <arquivo-backup.json>');
    process.exit(1);
  }

  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Arquivo não encontrado: ${backupFile}`);
    process.exit(1);
  }

  try {
    console.log(`📂 Lendo backup: ${backupFile}`);
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

    console.log(`📅 Backup de: ${backup.exportedAt}`);
    console.log(
      `📊 Contém: ${backup.counts.vehicles} veículos, ${backup.counts.conversations} conversas\n`
    );

    // Confirmar
    console.log('⚠️  ATENÇÃO: Isso vai SUBSTITUIR os dados existentes!');
    console.log('   Pressione Ctrl+C para cancelar ou aguarde 5 segundos...\n');
    await new Promise(r => setTimeout(r, 5000));

    // Limpar dados existentes
    console.log('🗑️  Limpando dados existentes...');
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.vehicle.deleteMany();
    try {
      await prisma.lead.deleteMany();
    } catch (e) {
      // Tabela pode não existir
    }

    // Importar veículos
    if (backup.data.vehicles && backup.data.vehicles.length > 0) {
      console.log(`📦 Importando ${backup.data.vehicles.length} veículos...`);

      for (const vehicle of backup.data.vehicles) {
        try {
          // Remover campos que podem causar conflito
          const { id, createdAt, updatedAt, ...vehicleData } = vehicle;

          await prisma.vehicle.create({
            data: {
              ...vehicleData,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
        } catch (e) {
          console.error(`   ⚠️  Erro ao importar veículo: ${vehicle.marca} ${vehicle.modelo}`);
        }
      }
      console.log('   ✅ Veículos importados');
    }

    // Importar conversas
    if (backup.data.conversations && backup.data.conversations.length > 0) {
      console.log(`📦 Importando ${backup.data.conversations.length} conversas...`);

      for (const conv of backup.data.conversations) {
        try {
          const { id, createdAt, updatedAt, ...convData } = conv;

          await prisma.conversation.create({
            data: {
              ...convData,
              createdAt: new Date(createdAt),
              updatedAt: new Date(updatedAt),
            },
          });
        } catch (e) {
          console.error(`   ⚠️  Erro ao importar conversa: ${conv.phoneNumber}`);
        }
      }
      console.log('   ✅ Conversas importadas');
    }

    // Importar mensagens
    if (backup.data.messages && backup.data.messages.length > 0) {
      console.log(`📦 Importando ${backup.data.messages.length} mensagens...`);

      let imported = 0;
      for (const msg of backup.data.messages) {
        try {
          const { id, createdAt, ...msgData } = msg;

          await prisma.message.create({
            data: {
              ...msgData,
              createdAt: new Date(createdAt),
            },
          });
          imported++;
        } catch (e) {
          // Pode falhar se conversa não existe
        }
      }
      console.log(`   ✅ ${imported} mensagens importadas`);
    }

    // Verificar resultado
    const vehicleCount = await prisma.vehicle.count();
    const convCount = await prisma.conversation.count();
    const msgCount = await prisma.message.count();

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('   ✅ IMPORTAÇÃO CONCLUÍDA!');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`\n📊 Resultado:`);
    console.log(`   Veículos: ${vehicleCount}`);
    console.log(`   Conversas: ${convCount}`);
    console.log(`   Mensagens: ${msgCount}`);
  } catch (error) {
    console.error('\n❌ Erro ao importar:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const backupFile = process.argv[2];
importDatabase(backupFile).catch(console.error);
