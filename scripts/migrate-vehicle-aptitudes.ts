/**
 * Migration Script for Vehicle Aptitudes
 *
 * This script processes all existing vehicles and calculates their aptitude fields
 * using the VehicleAptitudeClassifier service.
 *
 * Features:
 * - Batch processing (default: 10 vehicles per batch) to avoid LLM rate limits
 * - Progress logging with detailed statistics
 * - Checkpoint/resume capability (saves last processed ID to file)
 * - Validation of migration completeness
 *
 * Usage:
 *   npx ts-node scripts/migrate-vehicle-aptitudes.ts [options]
 *
 * Options:
 *   --batch-size N    Number of vehicles per batch (default: 10)
 *   --dry-run         Preview changes without saving to database
 *   --resume          Resume from last checkpoint
 *   --reset           Clear checkpoint and start fresh
 *   --validate        Only validate migration completeness
 *
 * Requirements: 7.1-7.4
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  VehicleAptitudeClassifier,
  VehicleForClassification,
  VehicleAptitudeResult,
} from '../src/services/vehicle-aptitude-classifier.service';

const prisma = new PrismaClient();
const classifier = new VehicleAptitudeClassifier();

// Checkpoint file path
const CHECKPOINT_FILE = path.join(__dirname, '.migrate-vehicle-aptitudes-checkpoint.json');

interface Checkpoint {
  lastProcessedId: string | null;
  processedCount: number;
  startedAt: string;
  lastUpdatedAt: string;
}

interface MigrationOptions {
  batchSize: number;
  dryRun: boolean;
  resume: boolean;
  reset: boolean;
  validateOnly: boolean;
}

interface MigrationStats {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
  startTime: Date;
  batchTimes: number[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);

  const batchSizeIndex = args.indexOf('--batch-size');
  const batchSize = batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1], 10) : 10;

  return {
    batchSize: isNaN(batchSize) ? 10 : batchSize,
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
    reset: args.includes('--reset'),
    validateOnly: args.includes('--validate'),
  };
}

/**
 * Load checkpoint from file
 */
function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️ Failed to load checkpoint file, starting fresh');
  }
  return null;
}

/**
 * Save checkpoint to file
 */
function saveCheckpoint(checkpoint: Checkpoint): void {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  } catch (error) {
    console.error('❌ Failed to save checkpoint:', (error as Error).message);
  }
}

/**
 * Clear checkpoint file
 */
function clearCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('🗑️ Checkpoint cleared');
    }
  } catch (error) {
    console.error('❌ Failed to clear checkpoint:', (error as Error).message);
  }
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculate estimated time remaining
 */
function estimateTimeRemaining(stats: MigrationStats): string {
  if (stats.batchTimes.length === 0) return 'calculating...';

  const avgBatchTime = stats.batchTimes.reduce((a, b) => a + b, 0) / stats.batchTimes.length;
  const remaining = stats.total - stats.processed - stats.skipped;
  const estimatedMs = (remaining / 10) * avgBatchTime; // Assuming batch size of 10

  return formatDuration(estimatedMs);
}

/**
 * Log progress with statistics
 */
function logProgress(stats: MigrationStats, checkpoint: Checkpoint): void {
  const elapsed = Date.now() - stats.startTime.getTime();
  const progress = (((stats.processed + stats.skipped) / stats.total) * 100).toFixed(1);
  const eta = estimateTimeRemaining(stats);

  console.log('');
  console.log('━'.repeat(60));
  console.log(`📊 Progress: ${progress}% (${stats.processed + stats.skipped}/${stats.total})`);
  console.log(`   ✅ Processed: ${stats.processed}`);
  console.log(`   ⏭️ Skipped (already classified): ${stats.skipped}`);
  console.log(`   ❌ Errors: ${stats.errors}`);
  console.log(`   ⏱️ Elapsed: ${formatDuration(elapsed)}`);
  console.log(`   🕐 ETA: ${eta}`);
  console.log(`   💾 Checkpoint: ${checkpoint.lastProcessedId || 'none'}`);
  console.log('━'.repeat(60));
  console.log('');
}

/**
 * Process a single vehicle
 */
async function processVehicle(
  vehicle: any,
  dryRun: boolean
): Promise<{ success: boolean; result?: VehicleAptitudeResult; error?: string }> {
  try {
    const input: VehicleForClassification = {
      id: vehicle.id,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      versao: vehicle.versao || undefined,
      ano: vehicle.ano,
      km: vehicle.km,
      preco: vehicle.preco || undefined,
      carroceria: vehicle.carroceria,
      combustivel: vehicle.combustivel,
      cambio: vehicle.cambio,
      portas: vehicle.portas,
      arCondicionado: vehicle.arCondicionado,
      airbag: vehicle.airbag,
      abs: vehicle.abs,
    };

    const result = await classifier.classify(input);

    if (!dryRun) {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoFamilia: result.aptoFamilia,
          aptoUberX: result.aptoUberX,
          aptoUberComfort: result.aptoUberComfort,
          aptoUberBlack: result.aptoUberBlack,
          aptoTrabalho: result.aptoTrabalho,
          aptoViagem: result.aptoViagem,
          aptoCarga: result.aptoCarga,
          aptoUsoDiario: result.aptoUsoDiario,
          aptoEntrega: result.aptoEntrega,
          scoreConforto: result.scoreConforto,
          scoreEconomia: result.scoreEconomia,
          scoreEspaco: result.scoreEspaco,
          scoreSeguranca: result.scoreSeguranca,
          scoreCustoBeneficio: result.scoreCustoBeneficio,
          categoriaVeiculo: result.categoriaVeiculo,
          segmentoPreco: result.segmentoPreco,
          classifiedAt: new Date(),
          classificationVersion: 1,
        },
      });
    }

    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Process a batch of vehicles
 */
async function processBatch(
  vehicles: any[],
  stats: MigrationStats,
  checkpoint: Checkpoint,
  options: MigrationOptions
): Promise<void> {
  const batchStart = Date.now();

  for (const vehicle of vehicles) {
    const vehicleLabel = `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`;

    // Check if already classified (has classifiedAt)
    if (vehicle.classifiedAt && !options.reset) {
      console.log(`   ⏭️ ${vehicleLabel} - already classified`);
      stats.skipped++;
      checkpoint.lastProcessedId = vehicle.id;
      continue;
    }

    console.log(`   🔄 ${vehicleLabel}...`);

    const { success, result, error } = await processVehicle(vehicle, options.dryRun);

    if (success && result) {
      const flags = [];
      if (result.aptoFamilia) flags.push('Família');
      if (result.aptoUberX) flags.push('UberX');
      if (result.aptoUberComfort) flags.push('Comfort');
      if (result.aptoUberBlack) flags.push('Black');
      if (result.aptoViagem) flags.push('Viagem');
      if (result.aptoCarga) flags.push('Carga');

      console.log(`      ✅ [${flags.join(', ') || 'Nenhuma aptidão'}]`);
      console.log(
        `      📊 Scores: Conforto=${result.scoreConforto}, Economia=${result.scoreEconomia}, Espaço=${result.scoreEspaco}`
      );
      stats.processed++;
    } else {
      console.log(`      ❌ Error: ${error}`);
      stats.errors++;
    }

    checkpoint.lastProcessedId = vehicle.id;
    checkpoint.processedCount = stats.processed + stats.skipped;
    checkpoint.lastUpdatedAt = new Date().toISOString();

    // Save checkpoint after each vehicle
    if (!options.dryRun) {
      saveCheckpoint(checkpoint);
    }
  }

  const batchTime = Date.now() - batchStart;
  stats.batchTimes.push(batchTime);

  // Keep only last 10 batch times for ETA calculation
  if (stats.batchTimes.length > 10) {
    stats.batchTimes.shift();
  }
}

/**
 * Validate migration completeness
 */
async function validateMigration(): Promise<{ complete: boolean; stats: any }> {
  console.log('🔍 Validating migration completeness...\n');

  const total = await prisma.vehicle.count();
  const classified = await prisma.vehicle.count({
    where: {
      classifiedAt: { not: null },
    },
  });
  const withScores = await prisma.vehicle.count({
    where: {
      AND: [
        { scoreConforto: { not: null } },
        { scoreEconomia: { not: null } },
        { scoreEspaco: { not: null } },
      ],
    },
  });

  const stats = {
    total,
    classified,
    withScores,
    unclassified: total - classified,
    missingScores: classified - withScores,
  };

  console.log('📊 Migration Status:');
  console.log('━'.repeat(40));
  console.log(`   Total vehicles: ${stats.total}`);
  console.log(
    `   Classified: ${stats.classified} (${((stats.classified / stats.total) * 100).toFixed(1)}%)`
  );
  console.log(`   With scores: ${stats.withScores}`);
  console.log(`   Unclassified: ${stats.unclassified}`);
  console.log(`   Missing scores: ${stats.missingScores}`);
  console.log('━'.repeat(40));

  const complete = stats.unclassified === 0 && stats.missingScores === 0;

  if (complete) {
    console.log('\n✅ Migration is COMPLETE! All vehicles have been classified.');
  } else {
    console.log('\n⚠️ Migration is INCOMPLETE.');
    if (stats.unclassified > 0) {
      console.log(`   ${stats.unclassified} vehicles need classification.`);
    }
    if (stats.missingScores > 0) {
      console.log(`   ${stats.missingScores} vehicles are missing scores.`);
    }
  }

  return { complete, stats };
}

/**
 * Main migration function
 */
async function migrateVehicleAptitudes(): Promise<void> {
  const options = parseArgs();

  console.log('');
  console.log('🚗 Vehicle Aptitude Migration Script');
  console.log('━'.repeat(60));
  console.log(`   Batch size: ${options.batchSize}`);
  console.log(`   Mode: ${options.dryRun ? '🔍 DRY-RUN (no changes)' : '💾 PRODUCTION'}`);
  console.log(`   Resume: ${options.resume ? 'Yes' : 'No'}`);
  console.log(`   Reset: ${options.reset ? 'Yes (reclassify all)' : 'No'}`);
  console.log('━'.repeat(60));
  console.log('');

  // Handle validate-only mode
  if (options.validateOnly) {
    await validateMigration();
    await prisma.$disconnect();
    return;
  }

  // Handle reset
  if (options.reset && !options.resume) {
    clearCheckpoint();
  }

  // Load or create checkpoint
  let checkpoint: Checkpoint;
  if (options.resume) {
    const loaded = loadCheckpoint();
    if (loaded) {
      checkpoint = loaded;
      console.log(`📂 Resuming from checkpoint: ${checkpoint.lastProcessedId}`);
      console.log(`   Previously processed: ${checkpoint.processedCount}`);
      console.log(`   Started at: ${checkpoint.startedAt}`);
      console.log('');
    } else {
      console.log('⚠️ No checkpoint found, starting fresh');
      checkpoint = {
        lastProcessedId: null,
        processedCount: 0,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      };
    }
  } else {
    checkpoint = {
      lastProcessedId: null,
      processedCount: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  // Initialize stats
  const stats: MigrationStats = {
    total: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    startTime: new Date(),
    batchTimes: [],
  };

  try {
    // Count total vehicles
    stats.total = await prisma.vehicle.count();
    console.log(`📊 Total vehicles in database: ${stats.total}`);
    console.log('');

    if (stats.total === 0) {
      console.log('⚠️ No vehicles found in database. Nothing to migrate.');
      return;
    }

    // Build query for fetching vehicles
    const whereClause: any = {};
    if (checkpoint.lastProcessedId && options.resume) {
      whereClause.id = { gt: checkpoint.lastProcessedId };
    }

    // Process in batches
    let hasMore = true;
    let batchNumber = 0;
    let cursor: string | undefined = checkpoint.lastProcessedId || undefined;

    while (hasMore) {
      batchNumber++;

      // Fetch batch of vehicles
      const vehicles = await prisma.vehicle.findMany({
        take: options.batchSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          marca: true,
          modelo: true,
          versao: true,
          ano: true,
          km: true,
          preco: true,
          carroceria: true,
          combustivel: true,
          cambio: true,
          portas: true,
          arCondicionado: true,
          airbag: true,
          abs: true,
          classifiedAt: true,
        },
      });

      if (vehicles.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`\n📦 Batch ${batchNumber} (${vehicles.length} vehicles):`);

      await processBatch(vehicles, stats, checkpoint, options);

      // Update cursor for next batch
      cursor = vehicles[vehicles.length - 1].id;

      // Log progress every 5 batches
      if (batchNumber % 5 === 0) {
        logProgress(stats, checkpoint);
      }

      // Check if we've processed all vehicles
      if (vehicles.length < options.batchSize) {
        hasMore = false;
      }

      // Small delay between batches to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final progress report
    logProgress(stats, checkpoint);

    // Validate migration
    console.log('\n');
    const { complete } = await validateMigration();

    // Clean up checkpoint if complete
    if (complete && !options.dryRun) {
      clearCheckpoint();
      console.log('\n🗑️ Checkpoint file removed (migration complete)');
    }

    // Final summary
    console.log('\n');
    console.log('🏁 Migration Summary:');
    console.log('━'.repeat(40));
    console.log(`   Total vehicles: ${stats.total}`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Duration: ${formatDuration(Date.now() - stats.startTime.getTime())}`);
    console.log('━'.repeat(40));

    if (options.dryRun) {
      console.log('\n⚠️ DRY-RUN MODE: No changes were saved to the database.');
      console.log('   Run without --dry-run to apply changes.');
    } else if (stats.errors > 0) {
      console.log('\n⚠️ Some vehicles had errors. Run with --resume to retry.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', (error as Error).message);
    console.error('   Run with --resume to continue from last checkpoint.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateVehicleAptitudes().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
