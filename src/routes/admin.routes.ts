import { Router } from 'express';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
// Build timestamp: 2025-11-28T19:25:00Z

const router = Router();

// ⚠️ IMPORTANTE: Este endpoint deve ser protegido em produção
const SEED_SECRET = process.env.SEED_SECRET || 'dev-secret-change-in-production';

// Middleware para validar secret
function requireSecret(req: any, res: any, next: () => void) {
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
 * Update Uber eligibility based on official requirements (sem whitelist)
 * 
 * CRITÉRIOS UBER/99 OFICIAIS:
 * 
 * Uber X / 99Pop:
 * - Ano: 2012 ou mais recente
 * - 4 portas
 * - Ar condicionado funcionando
 * - Sedan, Hatch ou Minivan (Spin, etc)
 * 
 * Uber Comfort / 99TOP:
 * - Ano: 2015 ou mais recente
 * - Sedan médio/grande
 * - Espaço interno generoso
 * 
 * Uber Black:
 * - Ano: 2018 ou mais recente
 * - Sedan executivo/premium
 * - Ar condicionado
 * - Preferencialmente cor escura
 */
async function updateUberWithWhitelist(req: any, res: any) {
  try {
    logger.info('🚖 Admin: Updating Uber eligibility (critérios oficiais)...');

    const vehicles = await prisma.vehicle.findMany();

    let uberXCount = 0;
    let uberComfortCount = 0;
    let uberBlackCount = 0;
    let familiaCount = 0;
    let trabalhoCount = 0;
    const uberVehicles: any[] = [];
    const rejectedVehicles: any[] = [];

    // Tipos NUNCA permitidos para apps
    const neverAllowed = ['pickup', 'picape', 'caminhonete', 'utilitario', 'furgao'];

    // Carrocerias aceitas para Uber X
    const uberXBodyTypes = ['sedan', 'hatch', 'hatchback', 'minivan', 'monovolume'];

    // Carrocerias aceitas para Uber Black (apenas sedans)
    const uberBlackBodyTypes = ['sedan'];

    for (const vehicle of vehicles) {
      const carrNorm = normalizeStr(vehicle.carroceria);
      const isNeverAllowed = neverAllowed.some(type => carrNorm.includes(type));
      const isUberXBodyType = uberXBodyTypes.some(type => carrNorm.includes(type));
      const isUberBlackBodyType = uberBlackBodyTypes.some(type => carrNorm.includes(type));

      // Uber X / 99Pop - Critérios oficiais (SEM whitelist)
      const isUberX = !isNeverAllowed &&
        vehicle.ano >= 2012 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        isUberXBodyType;

      // Uber Comfort / 99TOP
      const isUberComfort = !isNeverAllowed &&
        vehicle.ano >= 2015 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        (carrNorm.includes('sedan') || carrNorm.includes('minivan'));

      // Uber Black - Critérios oficiais (SEM whitelist)
      const isUberBlack = !isNeverAllowed &&
        vehicle.ano >= 2018 &&
        vehicle.arCondicionado === true &&
        vehicle.portas === 4 &&
        isUberBlackBodyType;

      // Fuel economy
      let economiaCombustivel = 'media';
      if (carrNorm.includes('hatch') || vehicle.km < 50000) {
        economiaCombustivel = 'alta';
      } else if (carrNorm.includes('suv') || vehicle.km > 150000) {
        economiaCombustivel = 'baixa';
      }

      // Family-friendly
      const aptoFamilia =
        vehicle.portas >= 4 &&
        (carrNorm.includes('suv') ||
          carrNorm.includes('sedan') ||
          carrNorm.includes('minivan'));

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
      if (isUberComfort) uberComfortCount++;
      if (isUberBlack) uberBlackCount++;
      if (aptoFamilia) familiaCount++;
      if (aptoTrabalho) trabalhoCount++;

      if (isUberX || isUberBlack) {
        uberVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          carroceria: vehicle.carroceria,
          preco: vehicle.preco,
          uberX: isUberX,
          uberComfort: isUberComfort,
          uberBlack: isUberBlack
        });
      } else if (!isNeverAllowed && vehicle.ano >= 2012 && vehicle.arCondicionado && vehicle.portas >= 4) {
        // Log vehicles that meet basic criteria but wrong body type
        rejectedVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          carroceria: vehicle.carroceria,
          reason: `Carroceria "${vehicle.carroceria}" não aceita para apps`
        });
      }
    }

    const summary = {
      totalVehicles: vehicles.length,
      uberX: uberXCount,
      uberComfort: uberComfortCount,
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

/**
 * POST /admin/validate-urls
 * Valida URLs dos veículos e marca indisponíveis os que têm links quebrados
 */
router.post('/validate-urls', requireSecret, async (req, res) => {
  try {
    logger.info('🔍 Admin: Validando URLs dos veículos...');

    const vehicles = await prisma.vehicle.findMany({
      where: {
        disponivel: true,
        url: { not: null }
      },
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        url: true
      }
    });

    logger.info(`📊 Total de veículos para validar: ${vehicles.length}`);

    const https = await import('https');
    const invalidVehicles: any[] = [];
    let validCount = 0;

    // Função para verificar URL
    const checkUrl = (url: string): Promise<{ valid: boolean; reason?: string }> => {
      return new Promise((resolve) => {
        if (!url) {
          resolve({ valid: false, reason: 'URL vazia' });
          return;
        }

        const options = {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 10000
        };

        https.get(url, options, (response: any) => {
          let data = '';
          response.on('data', (chunk: string) => data += chunk);
          response.on('end', () => {
            const html = data.toLowerCase();

            if (response.statusCode === 404 || response.statusCode === 410) {
              resolve({ valid: false, reason: `HTTP ${response.statusCode}` });
              return;
            }

            const isInvalid =
              html.includes('página não encontrada') ||
              html.includes('veículo não disponível') ||
              html.includes('anúncio não encontrado') ||
              html.includes('vendido') ||
              html.includes('não existe') ||
              (html.length < 5000 && !html.includes('quilometragem'));

            if (isInvalid) {
              resolve({ valid: false, reason: 'Página inválida/vendido' });
              return;
            }

            resolve({ valid: true });
          });
        })
          .on('error', (err: Error) => {
            resolve({ valid: false, reason: err.message });
          })
          .on('timeout', () => {
            resolve({ valid: false, reason: 'Timeout' });
          });
      });
    };

    // Processar em batches de 5
    const batchSize = 5;
    for (let i = 0; i < vehicles.length; i += batchSize) {
      const batch = vehicles.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (vehicle) => {
          const result = await checkUrl(vehicle.url || '');
          return { vehicle, result };
        })
      );

      for (const { vehicle, result } of results) {
        if (result.valid) {
          validCount++;
        } else {
          invalidVehicles.push({
            id: vehicle.id,
            name: `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`,
            url: vehicle.url,
            reason: result.reason
          });
        }
      }

      // Delay entre batches
      if (i + batchSize < vehicles.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Marcar veículos inválidos como indisponíveis
    if (invalidVehicles.length > 0) {
      const invalidIds = invalidVehicles.map(v => v.id);
      await prisma.vehicle.updateMany({
        where: { id: { in: invalidIds } },
        data: { disponivel: false }
      });
    }

    const finalCount = await prisma.vehicle.count({ where: { disponivel: true } });

    logger.info({ validCount, invalidCount: invalidVehicles.length, finalCount }, '✅ Admin: Validação concluída');

    res.json({
      success: true,
      message: 'Validação de URLs concluída',
      summary: {
        total: vehicles.length,
        valid: validCount,
        invalid: invalidVehicles.length,
        remainingAvailable: finalCount
      },
      invalidVehicles: invalidVehicles.slice(0, 20)
    });

  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Validação de URLs falhou');
    res.status(500).json({
      success: false,
      error: 'Validação falhou',
      details: error.message
    });
  }
});

/**
 * POST /admin/scrape-robustcar
 * Faz novo scraping da RobustCar e atualiza o banco
 * Query params:
 *   - useLLM=true: usa LLM para classificar categorias (mais preciso, mais lento)
 */
router.post('/scrape-robustcar', requireSecret, async (req, res) => {
  try {
    const useLLM = req.query.useLLM === 'true' || req.body.useLLM === true;

    logger.info({ useLLM }, '🚀 Admin: Iniciando scraping da RobustCar...');

    const https = await import('https');
    const baseUrl = 'https://robustcar.com.br';
    const searchUrl = 'https://robustcar.com.br/busca//pag/';
    const maxPages = 6;

    // Importar classificador LLM se necessário
    let classifyVehicle: any = null;
    if (useLLM) {
      const { vehicleClassifier } = await import('../services/vehicle-classifier.service');
      classifyVehicle = vehicleClassifier.classifyVehicle;
    }

    // Fallback: Mapeamento estático de categorias
    const CATEGORY_MAP: Record<string, string> = {
      'CRETA': 'SUV', 'COMPASS': 'SUV', 'RENEGADE': 'SUV', 'TRACKER': 'SUV',
      'ECOSPORT': 'SUV', 'DUSTER': 'SUV', 'HR-V': 'SUV', 'HRV': 'SUV',
      'TUCSON': 'SUV', 'SPORTAGE': 'SUV', 'RAV4': 'SUV', 'TIGGO': 'SUV',
      'KICKS': 'SUV', 'CAPTUR': 'SUV', 'T-CROSS': 'SUV', 'TCROSS': 'SUV',
      'CIVIC': 'SEDAN', 'COROLLA': 'SEDAN', 'CITY': 'SEDAN', 'CRUZE': 'SEDAN',
      'HB20S': 'SEDAN', 'SENTRA': 'SEDAN', 'LOGAN': 'SEDAN', 'VIRTUS': 'SEDAN',
      'ONIX': 'HATCH', 'HB20': 'HATCH', 'POLO': 'HATCH', 'GOL': 'HATCH',
      'MOBI': 'HATCH', 'KWID': 'HATCH', 'ARGO': 'HATCH', 'YARIS': 'HATCH',
      'TORO': 'PICKUP', 'STRADA': 'PICKUP', 'SAVEIRO': 'PICKUP', 'MONTANA': 'PICKUP',
      'HILUX': 'PICKUP', 'S10': 'PICKUP', 'RANGER': 'PICKUP', 'AMAROK': 'PICKUP',
      'SPIN': 'MINIVAN', 'MERIVA': 'MINIVAN', 'IDEA': 'MINIVAN',
    };

    const detectCategoryFallback = (brand: string, model: string): string => {
      const modelUpper = model.toUpperCase();
      for (const [key, category] of Object.entries(CATEGORY_MAP)) {
        if (modelUpper.includes(key)) return category;
      }
      return 'HATCH';
    };

    // Função para fazer requisição HTTPS
    const fetchPage = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        https.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 15000
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
    };

    // Extrair veículos do HTML
    const extractVehicles = (html: string): any[] => {
      const vehicles: any[] = [];
      const vehicleBlocks = html.split(/<h3[^>]*class="[^"]*titulo[^"]*"/).slice(1);

      for (const block of vehicleBlocks) {
        try {
          const urlMatch = block.match(/href="([^"]+)"/);
          if (!urlMatch) continue;

          const titleMatch = block.match(/>(\d{4})\s+(\w+(?:\s+\w+)?)\s+([^<]+)</);
          if (!titleMatch) continue;

          const [_, yearFromTitle, brand, modelVersion] = titleMatch;
          const listItems = block.match(/<li>([^<]+)<\/li>/g) || [];
          const listData = listItems.map(li => li.replace(/<\/?li>/g, '').trim());
          const priceMatch = block.match(/class="preco"[^>]*>([^<]+)/);

          const mvParts = modelVersion.trim().split(/\s+/);
          const model = mvParts[0];
          const version = mvParts.slice(1).join(' ');

          const price = priceMatch ?
            parseFloat(priceMatch[1].replace(/R\$|\./g, '').replace(',', '.').trim()) || null
            : null;

          vehicles.push({
            brand: brand.trim().toUpperCase(),
            model: model.trim().toUpperCase(),
            version: version.trim(),
            year: parseInt(listData[2]) || parseInt(yearFromTitle),
            mileage: parseInt((listData[3] || '0').replace(/\./g, '')) || 0,
            fuel: (listData[0] || 'FLEX').toUpperCase(),
            color: (listData[1] || 'N/I').toUpperCase(),
            price,
            detailUrl: urlMatch[1].startsWith('http') ? urlMatch[1] : `${baseUrl}${urlMatch[1]}`,
            category: detectCategoryFallback(brand, model) // Categoria inicial, pode ser atualizada pelo LLM
          });
        } catch (e) {
          // Skip malformed entries
        }
      }
      return vehicles;
    };

    // Fazer scraping
    const allVehicles: any[] = [];
    for (let page = 1; page <= maxPages; page++) {
      try {
        const html = await fetchPage(`${searchUrl}${page}/ordem/ano-desc/`);
        const vehicles = extractVehicles(html);
        if (vehicles.length === 0) break;
        allVehicles.push(...vehicles);
        logger.info(`📥 Página ${page}: ${vehicles.length} veículos`);
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        logger.error({ page, error }, 'Erro no scraping');
      }
    }

    logger.info(`📊 Total scrapeado: ${allVehicles.length} veículos`);

    // Atualizar banco de dados
    let created = 0;
    let updated = 0;
    let llmClassified = 0;

    for (const vehicle of allVehicles) {
      try {
        const existing = await prisma.vehicle.findFirst({
          where: { url: vehicle.detailUrl }
        });

        // Usar LLM para classificar se habilitado
        let classification = null;
        if (useLLM && classifyVehicle) {
          try {
            classification = await classifyVehicle({
              marca: vehicle.brand,
              modelo: vehicle.model,
              ano: vehicle.year,
              carroceria: vehicle.category,
              combustivel: vehicle.fuel
            });
            llmClassified++;
            logger.info({
              vehicle: `${vehicle.brand} ${vehicle.model}`,
              category: classification.category,
              confidence: classification.confidence
            }, 'LLM classification');
          } catch (llmError) {
            logger.warn({ vehicle: vehicle.model, error: llmError }, 'LLM classification failed, using fallback');
          }
        }

        const vehicleData = {
          marca: vehicle.brand,
          modelo: vehicle.model,
          versao: vehicle.version || '',
          ano: vehicle.year,
          km: vehicle.mileage,
          combustivel: vehicle.fuel,
          cor: vehicle.color,
          preco: vehicle.price || 0,
          carroceria: classification?.category || vehicle.category,
          url: vehicle.detailUrl,
          disponivel: true,
          // Aptidões (do LLM se disponível)
          aptoUber: classification?.aptoUber ?? false,
          aptoUberBlack: classification?.aptoUberBlack ?? false,
          aptoFamilia: classification?.aptoFamilia ?? false,
          aptoTrabalho: classification?.aptoTrabalho ?? false,
          // Limpar embedding para regenerar
          embedding: null,
          embeddingModel: null,
          embeddingGeneratedAt: null,
        };

        if (existing) {
          await prisma.vehicle.update({
            where: { id: existing.id },
            data: vehicleData
          });
          updated++;
        } else {
          await prisma.vehicle.create({ data: vehicleData });
          created++;
        }
      } catch (error) {
        logger.error({ vehicle, error }, 'Erro ao salvar veículo');
      }
    }

    // Marcar veículos antigos como indisponíveis
    const validUrls = allVehicles.map(v => v.detailUrl);
    const outdatedResult = await prisma.vehicle.updateMany({
      where: {
        url: { notIn: validUrls },
        disponivel: true
      },
      data: { disponivel: false }
    });

    const finalCount = await prisma.vehicle.count({ where: { disponivel: true } });

    logger.info({ created, updated, llmClassified, outdated: outdatedResult.count, finalCount }, '✅ Admin: Scraping concluído');

    res.json({
      success: true,
      message: 'Scraping e atualização concluídos',
      method: useLLM ? 'LLM classification' : 'Static mapping',
      summary: {
        scraped: allVehicles.length,
        created,
        updated,
        llmClassified: useLLM ? llmClassified : 0,
        markedOutdated: outdatedResult.count,
        totalAvailable: finalCount
      }
    });

  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Scraping falhou');
    res.status(500).json({
      success: false,
      error: 'Scraping falhou',
      details: error.message
    });
  }
});

/**
 * POST /admin/refresh-inventory
 * Executa validação de URLs + scraping + atualização (completo)
 */
router.post('/refresh-inventory', requireSecret, async (req, res) => {
  try {
    logger.info('🔄 Admin: Refresh completo do inventário...');

    // 1. Validar URLs existentes
    logger.info('🔍 Passo 1/2: Validando URLs existentes...');

    const vehiclesToValidate = await prisma.vehicle.findMany({
      where: { disponivel: true, url: { not: null } },
      select: { id: true, url: true }
    });

    const https = await import('https');
    let invalidCount = 0;

    const checkUrlQuick = (url: string): Promise<boolean> => {
      return new Promise((resolve) => {
        https.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000
        }, (res: any) => {
          if (res.statusCode === 404 || res.statusCode === 410) {
            resolve(false);
          } else {
            resolve(true);
          }
        }).on('error', () => resolve(false)).on('timeout', () => resolve(false));
      });
    };

    // Validar em paralelo (batches de 10)
    const invalidIds: string[] = [];
    for (let i = 0; i < vehiclesToValidate.length; i += 10) {
      const batch = vehiclesToValidate.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (v) => ({
          id: v.id,
          valid: await checkUrlQuick(v.url || '')
        }))
      );
      results.filter(r => !r.valid).forEach(r => invalidIds.push(r.id));
    }

    if (invalidIds.length > 0) {
      await prisma.vehicle.updateMany({
        where: { id: { in: invalidIds } },
        data: { disponivel: false }
      });
      invalidCount = invalidIds.length;
    }

    // 2. Scraping básico (primeiras 3 páginas para rapidez)
    logger.info('🚀 Passo 2/2: Scraping rápido...');

    const baseUrl = 'https://robustcar.com.br';
    const fetchPage = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
    };

    let newVehicles = 0;
    for (let page = 1; page <= 3; page++) {
      try {
        const html = await fetchPage(`${baseUrl}/busca//pag/${page}/ordem/ano-desc/`);
        const urlMatches = html.matchAll(/href="(\/carros\/[^"]+)"/g);

        for (const match of urlMatches) {
          const url = `${baseUrl}${match[1]}`;
          const exists = await prisma.vehicle.findFirst({ where: { url } });
          if (!exists) newVehicles++;
        }
      } catch (e) {
        logger.error({ page }, 'Erro no scraping');
      }
    }

    const finalCount = await prisma.vehicle.count({ where: { disponivel: true } });

    logger.info({ invalidCount, newVehicles, finalCount }, '✅ Admin: Refresh concluído');

    res.json({
      success: true,
      message: 'Refresh do inventário concluído',
      summary: {
        urlsInvalidated: invalidCount,
        potentialNewVehicles: newVehicles,
        totalAvailable: finalCount
      },
      note: newVehicles > 0
        ? `Encontrados ${newVehicles} novos veículos. Execute /admin/scrape-robustcar para importá-los.`
        : 'Inventário atualizado, sem novos veículos.'
    });

  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Refresh falhou');
    res.status(500).json({
      success: false,
      error: 'Refresh falhou',
      details: error.message
    });
  }
});

/**
 * GET /admin/debug-vehicles
 * Mostra estatísticas dos veículos no banco para debug
 */
router.get('/debug-vehicles', requireSecret, async (req, res) => {
  try {
    // Total de veículos
    const total = await prisma.vehicle.count();
    const available = await prisma.vehicle.count({ where: { disponivel: true } });

    // Agrupar por carroceria
    const byBodyType = await prisma.vehicle.groupBy({
      by: ['carroceria'],
      _count: true,
      where: { disponivel: true },
      orderBy: { _count: { carroceria: 'desc' } }
    });

    // Buscar pickups especificamente (case insensitive não funciona no groupBy)
    const pickups = await prisma.vehicle.findMany({
      where: {
        disponivel: true,
        OR: [
          { carroceria: { contains: 'pickup', mode: 'insensitive' } },
          { carroceria: { contains: 'picape', mode: 'insensitive' } },
          { modelo: { contains: 'strada', mode: 'insensitive' } },
          { modelo: { contains: 'toro', mode: 'insensitive' } },
          { modelo: { contains: 'saveiro', mode: 'insensitive' } },
          { modelo: { contains: 'hilux', mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        carroceria: true,
        disponivel: true,
        preco: true
      }
    });

    // Listar todos os valores únicos de carroceria
    const allBodyTypes = await prisma.vehicle.findMany({
      where: { disponivel: true },
      select: { carroceria: true },
      distinct: ['carroceria']
    });

    res.json({
      success: true,
      summary: {
        total,
        available,
        byBodyType: byBodyType.map(b => ({ type: b.carroceria, count: b._count }))
      },
      uniqueBodyTypes: allBodyTypes.map(b => b.carroceria),
      pickupsFound: pickups.length,
      pickups: pickups.map(p => ({
        id: p.id,
        name: `${p.marca} ${p.modelo} ${p.ano}`,
        carroceria: p.carroceria,
        disponivel: p.disponivel,
        preco: p.preco
      }))
    });

  } catch (error: any) {
    logger.error({ error }, '❌ Admin: Debug vehicles failed');
    res.status(500).json({
      success: false,
      error: error.message
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
      validateUrls: 'POST /admin/validate-urls?secret=YOUR_SECRET',
      scrapeRobustcar: 'POST /admin/scrape-robustcar?secret=YOUR_SECRET',
      refreshInventory: 'POST /admin/refresh-inventory?secret=YOUR_SECRET',
      debugVehicles: '/admin/debug-vehicles?secret=YOUR_SECRET',
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
