import { Router } from 'express';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';

const router = Router();

// ⚠️ IMPORTANTE: Este endpoint deve ser protegido em produção
const SEED_SECRET = process.env.SEED_SECRET || 'dev-secret-change-in-production';

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

// Endpoint de verificação
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: {
      seed: '/admin/seed-robustcar?secret=YOUR_SECRET',
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
