#!/usr/bin/env npx tsx
/**
 * Data Integrity Validation Script
 *
 * Validates the integrity of data in the Inovais database.
 * Run with: npx tsx scripts/validate-data-integrity.ts
 *
 * Checks:
 * - Orphaned records (leads without conversations, etc.)
 * - Missing embeddings
 * - Invalid vehicle data
 * - Stale conversations
 * - Duplicate records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  count: number;
  details?: string;
  items?: any[];
}

const results: ValidationResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function addResult(
  check: string,
  status: 'pass' | 'warn' | 'fail',
  count: number,
  details?: string,
  items?: any[]
) {
  results.push({ check, status, count, details, items: items?.slice(0, 5) });
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('               Inovais Data Integrity Validator');
  console.log('════════════════════════════════════════════════════════════\n');

  try {
    await prisma.$connect();
    log('✅', 'Database connection established\n');

    // 1. Check for conversations without messages
    log('🔍', 'Checking conversations without messages...');
    const emptyConversations = await prisma.conversation.findMany({
      where: {
        messages: { none: {} },
      },
      select: { id: true, phoneNumber: true, startedAt: true },
    });
    if (emptyConversations.length > 0) {
      addResult(
        'Conversations without messages',
        'warn',
        emptyConversations.length,
        'Conversations exist but have no messages - may be incomplete',
        emptyConversations
      );
      log('⚠️', `Found ${emptyConversations.length} conversations without messages`);
    } else {
      addResult('Conversations without messages', 'pass', 0);
      log('✅', 'All conversations have messages');
    }

    // 2. Check for orphaned leads (leads without valid conversation)
    log('🔍', 'Checking orphaned leads...');
    const allLeads = await prisma.lead.findMany({
      include: { conversation: true },
    });
    const orphanedLeads = allLeads.filter(l => !l.conversation);
    if (orphanedLeads.length > 0) {
      addResult(
        'Orphaned leads',
        'fail',
        orphanedLeads.length,
        'Leads exist without valid conversation reference',
        orphanedLeads.map(l => ({ id: l.id, name: l.name }))
      );
      log('❌', `Found ${orphanedLeads.length} orphaned leads`);
    } else {
      addResult('Orphaned leads', 'pass', 0);
      log('✅', 'No orphaned leads');
    }

    // 3. Check vehicles without embeddings
    log('🔍', 'Checking vehicles without embeddings...');
    const vehiclesWithoutEmbeddings = await prisma.vehicle.count({
      where: {
        disponivel: true,
        OR: [{ embedding: null }, { embedding: { equals: [] } }],
      },
    });
    const totalAvailableVehicles = await prisma.vehicle.count({
      where: { disponivel: true },
    });
    if (vehiclesWithoutEmbeddings > 0) {
      const percentage = Math.round((vehiclesWithoutEmbeddings / totalAvailableVehicles) * 100);
      addResult(
        'Vehicles without embeddings',
        percentage > 10 ? 'fail' : 'warn',
        vehiclesWithoutEmbeddings,
        `${percentage}% of available vehicles missing embeddings`
      );
      log(
        percentage > 10 ? '❌' : '⚠️',
        `${vehiclesWithoutEmbeddings}/${totalAvailableVehicles} vehicles without embeddings (${percentage}%)`
      );
    } else {
      addResult('Vehicles without embeddings', 'pass', 0);
      log('✅', 'All available vehicles have embeddings');
    }

    // 4. Check for invalid vehicle prices
    log('🔍', 'Checking invalid vehicle prices...');
    const invalidPrices = await prisma.vehicle.count({
      where: {
        disponivel: true,
        OR: [{ preco: null }, { preco: { lte: 0 } }],
      },
    });
    if (invalidPrices > 0) {
      addResult(
        'Vehicles with invalid prices',
        'warn',
        invalidPrices,
        'Available vehicles with null or zero price'
      );
      log('⚠️', `Found ${invalidPrices} vehicles with invalid prices`);
    } else {
      addResult('Vehicles with invalid prices', 'pass', 0);
      log('✅', 'All available vehicles have valid prices');
    }

    // 5. Check for stale active conversations (older than 24h)
    log('🔍', 'Checking stale active conversations...');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleConversations = await prisma.conversation.count({
      where: {
        status: 'active',
        lastMessageAt: { lt: oneDayAgo },
      },
    });
    if (staleConversations > 0) {
      addResult(
        'Stale active conversations',
        'warn',
        staleConversations,
        'Active conversations with no activity in 24+ hours'
      );
      log('⚠️', `Found ${staleConversations} stale active conversations`);
    } else {
      addResult('Stale active conversations', 'pass', 0);
      log('✅', 'No stale active conversations');
    }

    // 6. Check for duplicate leads (same phone, same day)
    log('🔍', 'Checking for duplicate leads...');
    const duplicateLeadsResult = await prisma.$queryRaw<{ phone: string; count: bigint }[]>`
      SELECT phone, COUNT(*) as count 
      FROM "Lead" 
      WHERE "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY phone 
      HAVING COUNT(*) > 1
    `;
    const duplicateLeads = duplicateLeadsResult.length;
    if (duplicateLeads > 0) {
      addResult(
        'Duplicate leads (same phone)',
        'warn',
        duplicateLeads,
        'Multiple leads with same phone number in last 7 days'
      );
      log('⚠️', `Found ${duplicateLeads} phone numbers with duplicate leads`);
    } else {
      addResult('Duplicate leads (same phone)', 'pass', 0);
      log('✅', 'No duplicate leads detected');
    }

    // 7. Check recommendations with invalid vehicle references
    log('🔍', 'Checking recommendations with invalid vehicles...');
    const invalidRecommendations = await prisma.recommendation.findMany({
      where: {
        vehicle: {
          disponivel: false,
        },
      },
      select: { id: true, vehicleId: true, conversationId: true },
      take: 10,
    });
    if (invalidRecommendations.length > 0) {
      addResult(
        'Recommendations with unavailable vehicles',
        'warn',
        invalidRecommendations.length,
        'Recommendations pointing to unavailable vehicles'
      );
      log('⚠️', `Found ${invalidRecommendations.length} recommendations with unavailable vehicles`);
    } else {
      addResult('Recommendations with unavailable vehicles', 'pass', 0);
      log('✅', 'All recommendations reference available vehicles');
    }

    // 8. Check for vehicles with missing required fields
    log('🔍', 'Checking vehicles with missing required fields...');
    const incompleteVehicles = await prisma.vehicle.count({
      where: {
        disponivel: true,
        OR: [
          { marca: null },
          { marca: '' },
          { modelo: null },
          { modelo: '' },
          { ano: null },
          { ano: { lt: 1990 } },
        ],
      },
    });
    if (incompleteVehicles > 0) {
      addResult(
        'Vehicles with missing required fields',
        'fail',
        incompleteVehicles,
        'Available vehicles missing marca, modelo, or valid ano'
      );
      log('❌', `Found ${incompleteVehicles} vehicles with missing required fields`);
    } else {
      addResult('Vehicles with missing required fields', 'pass', 0);
      log('✅', 'All available vehicles have required fields');
    }

    // Print summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('                           SUMMARY');
    console.log('════════════════════════════════════════════════════════════\n');

    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;

    console.log(`  ✅ Passed:   ${passed}`);
    console.log(`  ⚠️  Warnings: ${warnings}`);
    console.log(`  ❌ Failed:   ${failed}`);
    console.log(`  ─────────────────`);
    console.log(`  📊 Total:    ${results.length} checks\n`);

    if (failed > 0) {
      console.log('❌ CRITICAL ISSUES FOUND - Action required!\n');
      results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`  • ${r.check}: ${r.count} issues`);
          if (r.details) console.log(`    ${r.details}`);
        });
    } else if (warnings > 0) {
      console.log('⚠️  WARNINGS FOUND - Review recommended\n');
    } else {
      console.log('✅ ALL CHECKS PASSED - Data integrity verified!\n');
    }

    // Return exit code based on results
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Validation failed with error:', error);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main();
