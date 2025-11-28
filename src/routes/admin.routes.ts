import { Router } from 'express';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
// Build timestamp: 2025-11-28T19:25:00Z

const router = Router();

// ⚠️ IMPORTANTE: Este endpoint deve ser protegido em produção
const SEED_SECRET = process.env.SEED_SECRET || 'dev-secret-change-in-production';

// Middleware para validar secret
function requireSecret(req: any, res: any, next: Function) {
  const secret = req.query.secret || req.headers['x-admin-secret'];
  if (secret !== SEED_SECRET) {
    logger.warn('Unauthorized admin access attempt');
    return res.status(403).json({ error: 'Unauthorized - Invalid secret' });
  }
  next();
}

router.get('/seed-robustcar', async (req, res) => {
  const { secret } = req.query;
  
  // Validação de autenticação
  if (secret !== SEED_SECRET) {
    logger.warn('Tentativa de acesso não autorizado ao endpoint de seed');
    return res.status(403).json({ 
      success: false,
      error: 'Unauthorized - Invalid secret' 
    });
  }
  
  try {
    logger.info('🚀 Seed Robust Car iniciado via HTTP endpoint');
    
    // Verificar se arquivo existe
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const jsonPath = join(process.cwd(), 'scripts', 'robustcar-vehicles.json');
    
    if (!existsSync(jsonPath)) {
      throw new Error(`Arquivo não encontrado: ${jsonPath}`);
    }
    
    logger.info(`✅ Arquivo encontrado: ${jsonPath}`);
    
    // Executar seed
    logger.info('📦 Populando banco de dados...');
    const seedOutput = execSync('npx tsx prisma/seed-robustcar.ts', { 
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    logger.info('Seed output:', seedOutput);
    
    // Executar geração de embeddings
    logger.info('🔄 Gerando embeddings OpenAI...');
    const embeddingsOutput = execSync('npx tsx src/scripts/generate-embeddings.ts generate', { 
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
    
    logger.info('Embeddings output:', embeddingsOutput);
    
    logger.info('✅ Seed e embeddings concluídos com sucesso!');
    
    res.json({ 
      success: true,
      message: '✅ Seed e embeddings executados com sucesso!',
      seedOutput: seedOutput.split('\n').slice(-10).join('\n'), // Últimas 10 linhas
      embeddingsOutput: embeddingsOutput.split('\n').slice(-10).join('\n'),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error({ error }, '❌ Erro ao executar seed');
    
    const errorDetails = {
      message: error.message,
      stderr: error.stderr?.toString(),
      stdout: error.stdout?.toString(),
      code: error.code,
      cmd: error.cmd
    };
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: errorDetails,
      help: 'Verifique: 1) Arquivo robustcar-vehicles.json existe, 2) DATABASE_URL configurado, 3) OPENAI_API_KEY configurado'
    });
  }
});

/**
 * POST /admin/schema-push
 * Apply Prisma schema to database
 */
router.post('/schema-push', requireSecret, async (req, res) => {
  try {
    logger.info('🔧 Admin: Applying Prisma schema...');
    
    const output = execSync('npx prisma db push --accept-data-loss --skip-generate', {
      encoding: 'utf-8',
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024
    });
    
    logger.info('✅ Admin: Schema applied successfully');
    
    res.json({
      success: true,
      message: 'Schema applied successfully',
      output: output.substring(output.length - 500) // Last 500 chars
    });
    
  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Schema push failed');
    res.status(500).json({
      success: false,
      error: 'Schema push failed',
      details: error.message,
      stderr: error.stderr?.toString()
    });
  }
});

// Whitelist de modelos Uber
const UBER_X_MODELS: any = {
  honda: ['civic', 'city', 'fit'],
  toyota: ['corolla', 'etios', 'yaris'],
  chevrolet: ['onix', 'prisma', 'cruze', 'cobalt'],
  volkswagen: ['gol', 'voyage', 'polo', 'virtus', 'jetta', 'fox'],
  fiat: ['argo', 'cronos', 'siena', 'grand siena', 'palio', 'uno', 'mobi'],
  ford: ['ka', 'fiesta'],
  hyundai: ['hb20', 'hb20s', 'accent', 'elantra'],
  nissan: ['march', 'versa', 'sentra'],
  renault: ['logan', 'sandero', 'kwid']
};

const UBER_BLACK_MODELS: any = {
  honda: ['civic'],
  toyota: ['corolla'],
  chevrolet: ['cruze'],
  volkswagen: ['jetta'],
  nissan: ['sentra']
};

const NEVER_ALLOWED_TYPES = ['suv', 'pickup', 'picape', 'minivan', 'van'];

function normalizeStr(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function isInWhitelist(marca: string, modelo: string, whitelist: any): boolean {
  const marcaNorm = normalizeStr(marca);
  const modeloNorm = normalizeStr(modelo);
  if (!whitelist[marcaNorm]) return false;
  return whitelist[marcaNorm].some((m: string) => modeloNorm.includes(m) || m.includes(modeloNorm));
}

/**
 * POST /admin/update-uber
 * Mark vehicles eligible for Uber/99 (LLM-based, no static whitelist)
 */
router.post('/update-uber', requireSecret, async (req, res) => {
  // Check if should use LLM validation (new method)
  const useLLM = req.query.llm === 'true' || req.body.useLLM === true;
  
  if (useLLM) {
    return updateUberWithLLM(req, res);
  }
  
  // Legacy whitelist method (keeping for comparison)
  return updateUberWithWhitelist(req, res);
});

/**
 * Update Uber eligibility using LLM (recommended)
 */
async function updateUberWithLLM(req: any, res: any) {
  try {
    logger.info('🚖 Admin: Updating Uber eligibility with LLM...');
    
    const { uberEligibilityValidator } = await import('../services/uber-eligibility-validator.service');
    const vehicles = await prisma.vehicle.findMany();
    
    let uberXCount = 0;
    let uberComfortCount = 0;
    let uberBlackCount = 0;
    const results: any[] = [];
    
    for (const vehicle of vehicles) {
      const eligibility = await uberEligibilityValidator.validateEligibility({
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        carroceria: vehicle.carroceria,
        arCondicionado: vehicle.arCondicionado,
        portas: vehicle.portas,
        cambio: vehicle.cambio,
        cor: vehicle.cor
      });
      
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: eligibility.uberX,
          aptoUberBlack: eligibility.uberBlack
        }
      });
      
      if (eligibility.uberX) uberXCount++;
      if (eligibility.uberComfort) uberComfortCount++;
      if (eligibility.uberBlack) uberBlackCount++;
      
      if (eligibility.uberX || eligibility.uberComfort || eligibility.uberBlack) {
        results.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          uberX: eligibility.uberX,
          uberComfort: eligibility.uberComfort,
          uberBlack: eligibility.uberBlack,
          reasoning: eligibility.reasoning,
          confidence: eligibility.confidence
        });
      }
    }
    
    logger.info({ uberXCount, uberComfortCount, uberBlackCount }, '✅ Admin: Uber eligibility updated (LLM)');
    
    res.json({
      success: true,
      message: 'Uber eligibility updated (LLM validation)',
      method: 'llm',
      summary: {
        totalVehicles: vehicles.length,
        uberX: uberXCount,
        uberComfort: uberComfortCount,
        uberBlack: uberBlackCount
      },
      results: results.slice(0, 10)
    });
    
  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Update Uber eligibility with LLM failed');
    res.status(500).json({
      success: false,
      error: 'Update failed',
      details: error.message
    });
  }
}

/**
 * Legacy: Update with whitelist (keeping for comparison)
 */
async function updateUberWithWhitelist(req: any, res: any) {
  try {
    logger.info('🚖 Admin: Updating Uber eligibility (whitelist mode)...');
    
    const vehicles = await prisma.vehicle.findMany();
    
    let uberXCount = 0;
    let uberBlackCount = 0;
    let familiaCount = 0;
    let trabalhoCount = 0;
    const uberVehicles: any[] = [];
    const rejectedVehicles: any[] = [];
    
    for (const vehicle of vehicles) {
      const carrNorm = normalizeStr(vehicle.carroceria);
      const isNeverAllowed = NEVER_ALLOWED_TYPES.some(type => carrNorm.includes(type));
      
      // Uber X / 99Pop (com whitelist)
      const isUberX = !isNeverAllowed &&
        vehicle.ano >= 2012 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        isInWhitelist(vehicle.marca, vehicle.modelo, UBER_X_MODELS);
      
      // Uber Black (whitelist rigorosa)
      const isUberBlack = !isNeverAllowed &&
        vehicle.ano >= 2018 &&
        vehicle.arCondicionado === true &&
        vehicle.portas === 4 &&
        carrNorm.includes('sedan') &&
        isInWhitelist(vehicle.marca, vehicle.modelo, UBER_BLACK_MODELS);
      
      // Fuel economy
      let economiaCombustivel = 'media';
      if (vehicle.carroceria.toLowerCase().includes('hatch') || vehicle.km < 50000) {
        economiaCombustivel = 'alta';
      } else if (vehicle.carroceria.toLowerCase().includes('suv') || vehicle.km > 150000) {
        economiaCombustivel = 'baixa';
      }
      
      // Family-friendly
      const aptoFamilia = 
        vehicle.portas >= 4 &&
        (vehicle.carroceria.toLowerCase().includes('suv') ||
         vehicle.carroceria.toLowerCase().includes('sedan') ||
         vehicle.carroceria.toLowerCase().includes('minivan'));
      
      // Work-suitable
      const aptoTrabalho = 
        economiaCombustivel !== 'baixa' &&
        vehicle.arCondicionado === true;
      
      // Update
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: isUberX,
          aptoUberBlack: isUberBlack,
          economiaCombustivel,
          aptoFamilia,
          aptoTrabalho
        }
      });
      
      if (isUberX) uberXCount++;
      if (isUberBlack) uberBlackCount++;
      if (aptoFamilia) familiaCount++;
      if (aptoTrabalho) trabalhoCount++;
      
      if (isUberX || isUberBlack) {
        uberVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          preco: vehicle.preco,
          uberX: isUberX,
          uberBlack: isUberBlack
        });
      } else if (!isNeverAllowed && vehicle.ano >= 2012 && vehicle.arCondicionado && vehicle.portas >= 4) {
        // Log vehicles that meet basic criteria but not in whitelist
        rejectedVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          reason: 'Not in whitelist'
        });
      }
    }
    
    const summary = {
      totalVehicles: vehicles.length,
      uberX: uberXCount,
      uberBlack: uberBlackCount,
      familia: familiaCount,
      trabalho: trabalhoCount
    };
    
    logger.info({ summary }, '✅ Admin: Uber eligibility updated');
    
    res.json({
      success: true,
      message: 'Uber eligibility updated (whitelist mode)',
      summary,
      uberVehicles: uberVehicles.slice(0, 10), // First 10
      rejectedVehicles: rejectedVehicles.slice(0, 5) // Show some rejected
    });
    
  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Update Uber eligibility failed');
    res.status(500).json({
      success: false,
      error: 'Update failed',
      details: error.message
    });
  }
}

/**
 * GET /admin/vehicles-uber
 * List Uber-eligible vehicles
 */
router.get('/vehicles-uber', requireSecret, async (req, res) => {
  try {
    const type = req.query.type as string; // 'x' or 'black'
    
    const where: any = {};
    if (type === 'black') {
      where.aptoUberBlack = true;
    } else {
      where.aptoUber = true;
    }
    
    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        preco: true,
        km: true,
        carroceria: true,
        aptoUber: true,
        aptoUberBlack: true
      },
      orderBy: { preco: 'asc' }
    });
    
    res.json({
      success: true,
      count: vehicles.length,
      type: type || 'x',
      vehicles
    });
    
  } catch (error: any) {
    logger.error({ error }, '❌ Admin: List Uber vehicles failed');
    res.status(500).json({
      success: false,
      error: 'Failed to list vehicles',
      details: error.message
    });
  }
});

// Endpoint de verificação
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: {
      seed: '/admin/seed-robustcar?secret=YOUR_SECRET',
      schemaPush: 'POST /admin/schema-push?secret=YOUR_SECRET',
      updateUber: 'POST /admin/update-uber?secret=YOUR_SECRET',
      vehiclesUber: '/admin/vehicles-uber?secret=YOUR_SECRET&type=x',
      debug: '/admin/debug-env?secret=YOUR_SECRET'
    }
  });
});

// Endpoint de debug (verificar ambiente)
router.get('/debug-env', async (req, res) => {
  const { secret } = req.query;
  
  if (secret !== SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const { execSync } = await import('child_process');
    
    const cwd = process.cwd();
    const jsonPath = join(cwd, 'scripts', 'robustcar-vehicles.json');
    const seedPath = join(cwd, 'prisma', 'seed-robustcar.ts');
    
    // Listar arquivos
    const scriptsFiles = execSync('ls -la scripts/', { cwd, encoding: 'utf-8' });
    const prismaFiles = execSync('ls -la prisma/', { cwd, encoding: 'utf-8' });
    
    res.json({
      cwd,
      paths: {
        json: jsonPath,
        jsonExists: existsSync(jsonPath),
        seed: seedPath,
        seedExists: existsSync(seedPath)
      },
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? '✅ Configurado' : '❌ Não configurado',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ Não configurado',
        NODE_ENV: process.env.NODE_ENV
      },
      files: {
        scripts: scriptsFiles.split('\n').filter(l => l.includes('robustcar')),
        prisma: prismaFiles.split('\n').filter(l => l.includes('seed'))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
