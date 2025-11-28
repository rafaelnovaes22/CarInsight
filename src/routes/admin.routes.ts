import { Router } from 'express';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

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

/**
 * POST /admin/update-uber
 * Mark vehicles eligible for Uber/99
 */
router.post('/update-uber', requireSecret, async (req, res) => {
  try {
    logger.info('🚖 Admin: Updating Uber eligibility...');
    
    const vehicles = await prisma.vehicle.findMany();
    
    let uberXCount = 0;
    let uberBlackCount = 0;
    let familiaCount = 0;
    let trabalhoCount = 0;
    const uberVehicles: any[] = [];
    
    for (const vehicle of vehicles) {
      // Uber X / 99Pop criteria
      const isUberX = 
        vehicle.ano >= 2012 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        (vehicle.carroceria.toLowerCase().includes('sedan') || 
         vehicle.carroceria.toLowerCase().includes('hatch'));
      
      // Uber Black criteria
      const isUberBlack = 
        vehicle.ano >= 2018 &&
        vehicle.arCondicionado === true &&
        vehicle.portas === 4 &&
        vehicle.carroceria.toLowerCase().includes('sedan') &&
        ['honda', 'toyota', 'volkswagen', 'chevrolet', 'nissan', 'ford', 'hyundai', 'fiat']
          .some(marca => vehicle.marca.toLowerCase().includes(marca));
      
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
      message: 'Uber eligibility updated successfully',
      summary,
      uberVehicles: uberVehicles.slice(0, 10) // First 10
    });
    
  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Update Uber eligibility failed');
    res.status(500).json({
      success: false,
      error: 'Update failed',
      details: error.message
    });
  }
});

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
