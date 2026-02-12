import { Router } from 'express';
import { AdminTaskExecutionError, runAdminTask } from '../services/admin-task-runner.service';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { metricsService, MetricsPeriod } from '../services/metrics.service';

const router = Router();

// IMPORTANT: This endpoint must be protected in production
const SEED_SECRET = process.env.SEED_SECRET;

// Middleware para validar secret
function requireSecret(req: any, res: any, next: () => void) {
  if (!SEED_SECRET) {
    logger.error('SEED_SECRET is not configured; admin routes are disabled');
    return res.status(503).json({ error: 'Admin routes are disabled' });
  }

  const headerSecret = req.headers['x-admin-secret'];
  const authHeader = req.headers.authorization as string | undefined;
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const secret = headerSecret || bearerSecret;

  if (secret !== SEED_SECRET) {
    logger.warn('Unauthorized admin access attempt');
    return res.status(403).json({ error: 'Unauthorized - Invalid secret' });
  }
  next();
}

/**
 * GET /admin/seed-renatinhu
 * Limpa veÃ­culos antigos e repopula com dados da Renatinhu's Cars
 * IMPORTANT: This is the MAIN endpoint for inventory updates in production
 */
router.get('/seed-renatinhu', requireSecret, async (req, res) => {
  try {
    logger.info("ðŸš€ Seed Renatinhu's Cars iniciado via HTTP endpoint");

    // Contar veÃ­culos atuais
    const oldCount = await prisma.vehicle.count();
    logger.info(`ðŸ“Š VeÃ­culos atuais: ${oldCount}`);

    // Limpar veÃ­culos antigos
    // logger.info('ðŸ—‘ï¸ Removendo veÃ­culos antigos...');
    // await prisma.vehicle.deleteMany({});
    // logger.info('âœ… VeÃ­culos antigos removidos');

    // Executar seed da Renatinhu (o script jÃ¡ cuida da limpeza na ordem correta)
    logger.info("ðŸ“¦ Populando banco com dados da Renatinhu's Cars...");
    const seedTask = await runAdminTask('seedRenatinhu');
    const seedOutput = seedTask.stdout;
    logger.info({ exitCode: seedTask.exitCode }, 'Seed command finished');

    // Contar novos veÃ­culos
    const newCount = await prisma.vehicle.count();
    logger.info(`ðŸ“Š Novos veÃ­culos: ${newCount}`);

    // Executar geraÃ§Ã£o de embeddings
    logger.info('ðŸ”„ Gerando embeddings OpenAI...');
    const embeddingsTask = await runAdminTask('generateEmbeddings');
    const embeddingsOutput = embeddingsTask.stdout;
    logger.info({ exitCode: embeddingsTask.exitCode }, 'Embeddings command finished');

    logger.info("âœ… Seed Renatinhu's Cars concluÃ­do com sucesso!");

    res.json({
      success: true,
      message: "âœ… Seed Renatinhu's Cars executado com sucesso!",
      summary: {
        vehiclesRemoved: oldCount,
        vehiclesAdded: newCount,
      },
      seedOutput: seedOutput.split('\n').slice(-10).join('\n'), // Ãšltimas 10 linhas
      embeddingsOutput: embeddingsOutput.split('\n').slice(-10).join('\n'),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Erro ao executar seed');

    const errorDetails =
      error instanceof AdminTaskExecutionError
        ? {
            message: error.message,
            stderr: error.stderr,
            stdout: error.stdout,
            code: error.exitCode,
            cmd: `${error.command} ${error.args.join(' ')}`,
          }
        : {
            message: error.message,
            stderr: error.stderr?.toString(),
            stdout: error.stdout?.toString(),
            code: error.code,
            cmd: error.cmd,
          };

    res.status(500).json({
      success: false,
      error: error.message,
      details: errorDetails,
      help: 'Verifique: 1) DATABASE_URL configurado, 2) OPENAI_API_KEY configurado',
    });
  }
});

/**
 * GET /admin/seed-robustcar (LEGADO - mantido para compatibilidade)
 * @deprecated Use /admin/seed-renatinhu para dados atualizados
 */
router.get('/seed-robustcar', requireSecret, async (req, res) => {
  try {
    logger.info('ðŸš€ Seed Robust Car iniciado via HTTP endpoint');

    // Verificar se arquivo existe
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const jsonPath = join(process.cwd(), 'scripts', 'robustcar-vehicles.json');

    if (!existsSync(jsonPath)) {
      throw new Error(`Arquivo nÃ£o encontrado: ${jsonPath}`);
    }

    logger.info(`âœ… Arquivo encontrado: ${jsonPath}`);

    // Executar seed
    logger.info('ðŸ“¦ Populando banco de dados...');
    const seedTask = await runAdminTask('seedRobustcar');
    const seedOutput = seedTask.stdout;
    logger.info({ exitCode: seedTask.exitCode }, 'Legacy seed command finished');

    // Executar geraÃ§Ã£o de embeddings
    logger.info('ðŸ”„ Gerando embeddings OpenAI...');
    const embeddingsTask = await runAdminTask('generateEmbeddings');
    const embeddingsOutput = embeddingsTask.stdout;
    logger.info({ exitCode: embeddingsTask.exitCode }, 'Embeddings command finished');

    logger.info('âœ… Seed e embeddings concluÃ­dos com sucesso!');

    res.json({
      success: true,
      message: 'âœ… Seed e embeddings executados com sucesso!',
      seedOutput: seedOutput.split('\n').slice(-10).join('\n'), // Ãšltimas 10 linhas
      embeddingsOutput: embeddingsOutput.split('\n').slice(-10).join('\n'),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Erro ao executar seed');

    const errorDetails =
      error instanceof AdminTaskExecutionError
        ? {
            message: error.message,
            stderr: error.stderr,
            stdout: error.stdout,
            code: error.exitCode,
            cmd: `${error.command} ${error.args.join(' ')}`,
          }
        : {
            message: error.message,
            stderr: error.stderr?.toString(),
            stdout: error.stdout?.toString(),
            code: error.code,
            cmd: error.cmd,
          };

    res.status(500).json({
      success: false,
      error: error.message,
      details: errorDetails,
      help: 'Verifique: 1) Arquivo robustcar-vehicles.json existe, 2) DATABASE_URL configurado, 3) OPENAI_API_KEY configurado',
    });
  }
});

/**
 * POST /admin/schema-push
 * Apply Prisma schema to database
 */
router.post('/schema-push', requireSecret, async (req, res) => {
  try {
    logger.info('ðŸ”§ Admin: Applying Prisma schema...');

    const schemaTask = await runAdminTask('schemaPush');
    const output = schemaTask.stdout || schemaTask.stderr;

    logger.info('âœ… Admin: Schema applied successfully');

    res.json({
      success: true,
      message: 'Schema applied successfully',
      output: output.substring(output.length - 500), // Last 500 chars
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: Schema push failed');
    res.status(500).json({
      success: false,
      error: 'Schema push failed',
      details: error.message,
      stderr: error instanceof AdminTaskExecutionError ? error.stderr : error.stderr?.toString(),
    });
  }
});

/**
 * GET /admin/update-urls
 * Atualiza URLs dos veÃ­culos para o site da Renatinhu's Cars
 * URL Pattern: https://www.renatinhuscars.com.br/?veiculo={marca}+{modelo}+{versao}&id={id}
 * O ID Ã© extraÃ­do do fotoUrl (padrÃ£o: 394_{id}_1-1.jpg)
 */
router.get('/update-urls', requireSecret, async (req, res) => {
  try {
    logger.info('ðŸ”— Admin: Atualizando URLs dos veÃ­culos...');

    const BASE_URL = 'https://www.renatinhuscars.com.br/';

    // Helper function to extract vehicle ID from fotoUrl
    const extractVehicleId = (fotoUrl: string | null): string | null => {
      if (!fotoUrl) return null;
      const match = fotoUrl.match(/394_(\d+)_/);
      return match ? match[1] : null;
    };

    // Helper function to build vehicle URL
    const buildVehicleUrl = (
      marca: string,
      modelo: string,
      versao: string,
      vehicleId: string
    ): string => {
      const veiculoName = `${marca} ${modelo} ${versao}`.trim().replace(/\s+/g, '+');
      return `${BASE_URL}?veiculo=${encodeURIComponent(veiculoName).replace(/%20/g, '+')}&id=${vehicleId}`;
    };

    const vehicles = await prisma.vehicle.findMany({
      select: {
        id: true,
        marca: true,
        modelo: true,
        versao: true,
        fotoUrl: true,
        url: true,
      },
    });

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const updatedVehicles: string[] = [];

    for (const vehicle of vehicles) {
      const vehicleId = extractVehicleId(vehicle.fotoUrl);

      if (!vehicleId) {
        logger.warn(`[WARN] Missing ID in fotoUrl: ${vehicle.marca} ${vehicle.modelo}`);
        failed++;
        continue;
      }

      const newUrl = buildVehicleUrl(
        vehicle.marca,
        vehicle.modelo,
        vehicle.versao || '',
        vehicleId
      );

      if (vehicle.url === newUrl) {
        skipped++;
        continue;
      }

      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { url: newUrl },
      });

      updatedVehicles.push(`${vehicle.marca} ${vehicle.modelo} -> id=${vehicleId}`);
      updated++;
    }

    logger.info(`âœ… URLs atualizadas: ${updated}, JÃ¡ atualizadas: ${skipped}, Sem ID: ${failed}`);

    res.json({
      success: true,
      message: 'âœ… URLs dos veÃ­culos atualizadas!',
      summary: {
        updated,
        skipped,
        failed,
        total: vehicles.length,
      },
      updatedVehicles: updatedVehicles.slice(0, 10), // Primeiros 10 para nÃ£o sobrecarregar
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Erro ao atualizar URLs');
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar URLs',
      details: error.message,
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
  renault: ['logan', 'sandero', 'kwid'],
};

const UBER_BLACK_MODELS: any = {
  honda: ['civic'],
  toyota: ['corolla'],
  chevrolet: ['cruze'],
  volkswagen: ['jetta'],
  nissan: ['sentra'],
};

const NEVER_ALLOWED_TYPES = ['suv', 'pickup', 'picape', 'minivan', 'van'];

function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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
    logger.info('ðŸš– Admin: Updating Uber eligibility with LLM...');

    const { uberEligibilityValidator } =
      await import('../services/uber-eligibility-validator.service');
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
        cor: vehicle.cor ?? undefined,
      });

      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: eligibility.uberX,
          aptoUberBlack: eligibility.uberBlack,
        },
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
          confidence: eligibility.confidence,
        });
      }
    }

    logger.info(
      { uberXCount, uberComfortCount, uberBlackCount },
      'âœ… Admin: Uber eligibility updated (LLM)'
    );

    res.json({
      success: true,
      message: 'Uber eligibility updated (LLM validation)',
      method: 'llm',
      summary: {
        totalVehicles: vehicles.length,
        uberX: uberXCount,
        uberComfort: uberComfortCount,
        uberBlack: uberBlackCount,
      },
      results: results.slice(0, 10),
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: Update Uber eligibility with LLM failed');
    res.status(500).json({
      success: false,
      error: 'Update failed',
      details: error.message,
    });
  }
}

/**
 * Update Uber eligibility based on official requirements (sem whitelist)
 *
 * CRITÃ‰RIOS UBER/99 OFICIAIS:
 *
 * Uber X / 99Pop:
 * - Ano: 2012 ou mais recente
 * - 4 portas
 * - Ar condicionado funcionando
 * - Sedan, Hatch ou Minivan (Spin, etc)
 *
 * Uber Comfort / 99TOP:
 * - Ano: 2015 ou mais recente
 * - Sedan mÃ©dio/grande
 * - EspaÃ§o interno generoso
 *
 * Uber Black:
 * - Ano: 2018 ou mais recente
 * - Sedan executivo/premium
 * - Ar condicionado
 * - Preferencialmente cor escura
 */
async function updateUberWithWhitelist(req: any, res: any) {
  try {
    logger.info('ðŸš– Admin: Updating Uber eligibility (critÃ©rios oficiais)...');

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

      // Uber X / 99Pop - CritÃ©rios oficiais (SEM whitelist)
      const isUberX =
        !isNeverAllowed &&
        vehicle.ano >= 2012 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        isUberXBodyType;

      // Uber Comfort / 99TOP
      const isUberComfort =
        !isNeverAllowed &&
        vehicle.ano >= 2015 &&
        vehicle.arCondicionado === true &&
        vehicle.portas >= 4 &&
        (carrNorm.includes('sedan') || carrNorm.includes('minivan'));

      // Uber Black - CritÃ©rios oficiais (SEM whitelist)
      const isUberBlack =
        !isNeverAllowed &&
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
        (carrNorm.includes('suv') || carrNorm.includes('sedan') || carrNorm.includes('minivan'));

      // Work-suitable
      const aptoTrabalho = economiaCombustivel !== 'baixa' && vehicle.arCondicionado === true;

      // Update
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          aptoUber: isUberX,
          aptoUberBlack: isUberBlack,
          economiaCombustivel,
          aptoFamilia,
          aptoTrabalho,
        },
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
          uberBlack: isUberBlack,
        });
      } else if (
        !isNeverAllowed &&
        vehicle.ano >= 2012 &&
        vehicle.arCondicionado &&
        vehicle.portas >= 4
      ) {
        // Log vehicles that meet basic criteria but wrong body type
        rejectedVehicles.push({
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          carroceria: vehicle.carroceria,
          reason: `Carroceria "${vehicle.carroceria}" nÃ£o aceita para apps`,
        });
      }
    }

    const summary = {
      totalVehicles: vehicles.length,
      uberX: uberXCount,
      uberComfort: uberComfortCount,
      uberBlack: uberBlackCount,
      familia: familiaCount,
      trabalho: trabalhoCount,
    };

    logger.info({ summary }, 'âœ… Admin: Uber eligibility updated');

    res.json({
      success: true,
      message: 'Uber eligibility updated (whitelist mode)',
      summary,
      uberVehicles: uberVehicles.slice(0, 10), // First 10
      rejectedVehicles: rejectedVehicles.slice(0, 5), // Show some rejected
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: Update Uber eligibility failed');
    res.status(500).json({
      success: false,
      error: 'Update failed',
      details: error.message,
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
        aptoUberBlack: true,
      },
      orderBy: { preco: 'asc' },
    });

    res.json({
      success: true,
      count: vehicles.length,
      type: type || 'x',
      vehicles,
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: List Uber vehicles failed');
    res.status(500).json({
      success: false,
      error: 'Failed to list vehicles',
      details: error.message,
    });
  }
});

/**
 * POST /admin/validate-urls
 * Valida URLs dos veÃ­culos e marca indisponÃ­veis os que tÃªm links quebrados
 */
router.post('/validate-urls', requireSecret, async (req, res) => {
  try {
    logger.info('ðŸ” Admin: Validando URLs dos veÃ­culos...');

    const vehicles = await prisma.vehicle.findMany({
      where: {
        disponivel: true,
        url: { not: null },
      },
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        url: true,
      },
    });

    logger.info(`ðŸ“Š Total de veÃ­culos para validar: ${vehicles.length}`);

    const https = await import('https');
    const invalidVehicles: any[] = [];
    let validCount = 0;

    // FunÃ§Ã£o para verificar URL
    const checkUrl = (url: string): Promise<{ valid: boolean; reason?: string }> => {
      return new Promise(resolve => {
        if (!url) {
          resolve({ valid: false, reason: 'URL vazia' });
          return;
        }

        const options = {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 10000,
        };

        https
          .get(url, options, (response: any) => {
            let data = '';
            response.on('data', (chunk: string) => (data += chunk));
            response.on('end', () => {
              const html = data.toLowerCase();

              if (response.statusCode === 404 || response.statusCode === 410) {
                resolve({ valid: false, reason: `HTTP ${response.statusCode}` });
                return;
              }

              const isInvalid =
                html.includes('pÃ¡gina nÃ£o encontrada') ||
                html.includes('veÃ­culo nÃ£o disponÃ­vel') ||
                html.includes('anÃºncio nÃ£o encontrado') ||
                html.includes('vendido') ||
                html.includes('nÃ£o existe') ||
                (html.length < 5000 && !html.includes('quilometragem'));

              if (isInvalid) {
                resolve({ valid: false, reason: 'PÃ¡gina invÃ¡lida/vendido' });
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
        batch.map(async vehicle => {
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
            reason: result.reason,
          });
        }
      }

      // Delay entre batches
      if (i + batchSize < vehicles.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Marcar veÃ­culos invÃ¡lidos como indisponÃ­veis
    if (invalidVehicles.length > 0) {
      const invalidIds = invalidVehicles.map(v => v.id);
      await prisma.vehicle.updateMany({
        where: { id: { in: invalidIds } },
        data: { disponivel: false },
      });
    }

    const finalCount = await prisma.vehicle.count({ where: { disponivel: true } });

    logger.info(
      { validCount, invalidCount: invalidVehicles.length, finalCount },
      'âœ… Admin: ValidaÃ§Ã£o concluÃ­da'
    );

    res.json({
      success: true,
      message: 'ValidaÃ§Ã£o de URLs concluÃ­da',
      summary: {
        total: vehicles.length,
        valid: validCount,
        invalid: invalidVehicles.length,
        remainingAvailable: finalCount,
      },
      invalidVehicles: invalidVehicles.slice(0, 20),
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: ValidaÃ§Ã£o de URLs falhou');
    res.status(500).json({
      success: false,
      error: 'ValidaÃ§Ã£o falhou',
      details: error.message,
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

    logger.info({ useLLM }, 'ðŸš€ Admin: Iniciando scraping da RobustCar...');

    const https = await import('https');
    const baseUrl = 'https://robustcar.com.br';
    const searchUrl = 'https://robustcar.com.br/busca//pag/';
    const maxPages = 6;

    // Importar classificador LLM se necessÃ¡rio
    // let classifyVehicle: any = null;
    // if (useLLM) {
    //   // const { vehicleClassifier } = await import('../services/vehicle-classifier.service');
    //   // classifyVehicle = vehicleClassifier.classifyVehicle;
    //   logger.warn('[WARN] LLM classification temporarily disabled due to missing service method');
    // }

    // Fallback: Mapeamento estÃ¡tico de categorias
    const CATEGORY_MAP: Record<string, string> = {
      CRETA: 'SUV',
      COMPASS: 'SUV',
      RENEGADE: 'SUV',
      TRACKER: 'SUV',
      ECOSPORT: 'SUV',
      DUSTER: 'SUV',
      'HR-V': 'SUV',
      HRV: 'SUV',
      TUCSON: 'SUV',
      SPORTAGE: 'SUV',
      RAV4: 'SUV',
      TIGGO: 'SUV',
      KICKS: 'SUV',
      CAPTUR: 'SUV',
      'T-CROSS': 'SUV',
      TCROSS: 'SUV',
      CIVIC: 'SEDAN',
      COROLLA: 'SEDAN',
      CITY: 'SEDAN',
      CRUZE: 'SEDAN',
      HB20S: 'SEDAN',
      SENTRA: 'SEDAN',
      LOGAN: 'SEDAN',
      VIRTUS: 'SEDAN',
      ONIX: 'HATCH',
      HB20: 'HATCH',
      POLO: 'HATCH',
      GOL: 'HATCH',
      MOBI: 'HATCH',
      KWID: 'HATCH',
      ARGO: 'HATCH',
      YARIS: 'HATCH',
      TORO: 'PICKUP',
      STRADA: 'PICKUP',
      SAVEIRO: 'PICKUP',
      MONTANA: 'PICKUP',
      HILUX: 'PICKUP',
      S10: 'PICKUP',
      RANGER: 'PICKUP',
      AMAROK: 'PICKUP',
      SPIN: 'MINIVAN',
      MERIVA: 'MINIVAN',
      IDEA: 'MINIVAN',
    };

    const detectCategoryFallback = (brand: string, model: string): string => {
      const modelUpper = model.toUpperCase();
      for (const [key, category] of Object.entries(CATEGORY_MAP)) {
        if (modelUpper.includes(key)) return category;
      }
      return 'HATCH';
    };

    // FunÃ§Ã£o para fazer requisiÃ§Ã£o HTTPS
    const fetchPage = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        https
          .get(
            url,
            {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              timeout: 15000,
            },
            (res: any) => {
              let data = '';
              res.on('data', (chunk: string) => (data += chunk));
              res.on('end', () => resolve(data));
            }
          )
          .on('error', reject);
      });
    };

    // Extrair veÃ­culos do HTML
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

          const price = priceMatch
            ? parseFloat(
                priceMatch[1]
                  .replace(/R\$|\./g, '')
                  .replace(',', '.')
                  .trim()
              ) || null
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
            category: detectCategoryFallback(brand, model), // Categoria inicial, pode ser atualizada pelo LLM
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
        logger.info(`ðŸ“¥ PÃ¡gina ${page}: ${vehicles.length} veÃ­culos`);
        await new Promise(r => setTimeout(r, 500));
      } catch (error) {
        logger.error({ page, error }, 'Erro no scraping');
      }
    }

    logger.info(`ðŸ“Š Total scrapeado: ${allVehicles.length} veÃ­culos`);

    // Atualizar banco de dados
    let created = 0;
    let updated = 0;
    const llmClassified = 0;

    for (const vehicle of allVehicles) {
      try {
        const existing = await prisma.vehicle.findFirst({
          where: { url: vehicle.detailUrl },
        });

        // Usar LLM para classificar se habilitado
        // let classification: ... | null = null;

        // if (useLLM && classifyVehicle) {
        //   try {
        //     classification = await classifyVehicle({
        //       marca: vehicle.brand,
        //       modelo: vehicle.model,
        //       ano: vehicle.year,
        //       carroceria: vehicle.category,
        //       combustivel: vehicle.fuel,
        //     });
        //     llmClassified++;
        //     logger.info(
        //       {
        //         vehicle: `${vehicle.brand} ${vehicle.model}`,
        //         category: classification?.category,
        //         confidence: classification?.confidence,
        //       },
        //       'LLM classification'
        //     );
        //   } catch (llmError) {
        //     logger.warn(
        //       { vehicle: vehicle.model, error: llmError },
        //       'LLM classification failed, using fallback'
        //     );
        //   }
        // }

        const vehicleData = {
          marca: vehicle.brand,
          modelo: vehicle.model,
          versao: vehicle.version || '',
          ano: vehicle.year,
          km: vehicle.mileage,
          combustivel: vehicle.fuel,
          cor: vehicle.color,
          preco: vehicle.price || 0,
          carroceria: vehicle.category,
          url: vehicle.detailUrl,
          disponivel: true,
          // AptidÃµes (do LLM se disponÃ­vel)
          aptoUber: false,
          aptoUberBlack: false,
          aptoFamilia: false,
          aptoTrabalho: false,
          // Limpar embedding para regenerar
          embedding: null,
          embeddingModel: null,
          embeddingGeneratedAt: null,
        };

        const { vehicleEligibilityOnCreateService } =
          await import('../services/vehicle-eligibility-on-create.service');

        if (existing) {
          await prisma.vehicle.update({
            where: { id: existing.id },
            data: vehicleData,
          });
          updated++;
        } else {
          const createdVehicle = await prisma.vehicle.create({ data: vehicleData });
          await vehicleEligibilityOnCreateService.markDefaultEligibility(createdVehicle.id);
          created++;
        }
      } catch (error) {
        logger.error({ vehicle, error }, 'Erro ao salvar veÃ­culo');
      }
    }

    // Marcar veÃ­culos antigos como indisponÃ­veis
    const validUrls = allVehicles.map(v => v.detailUrl);
    const outdatedResult = await prisma.vehicle.updateMany({
      where: {
        url: { notIn: validUrls },
        disponivel: true,
      },
      data: { disponivel: false },
    });

    const finalCount = await prisma.vehicle.count({ where: { disponivel: true } });

    logger.info(
      { created, updated, llmClassified, outdated: outdatedResult.count, finalCount },
      'âœ… Admin: Scraping concluÃ­do'
    );

    res.json({
      success: true,
      message: 'Scraping e atualizaÃ§Ã£o concluÃ­dos',
      method: useLLM ? 'LLM classification' : 'Static mapping',
      summary: {
        scraped: allVehicles.length,
        created,
        updated,
        llmClassified: useLLM ? llmClassified : 0,
        markedOutdated: outdatedResult.count,
        totalAvailable: finalCount,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: Scraping falhou');
    res.status(500).json({
      success: false,
      error: 'Scraping falhou',
      details: error.message,
    });
  }
});

/**
 * POST /admin/refresh-inventory
 * Executa validaÃ§Ã£o de URLs + scraping + atualizaÃ§Ã£o (completo)
 */
router.post('/refresh-inventory', requireSecret, async (req, res) => {
  try {
    logger.info('ðŸ”„ Admin: Refresh completo do inventÃ¡rio...');

    // 1. Validar URLs existentes
    logger.info('ðŸ” Passo 1/2: Validando URLs existentes...');

    const vehiclesToValidate = await prisma.vehicle.findMany({
      where: { disponivel: true, url: { not: null } },
      select: { id: true, url: true },
    });

    const https = await import('https');
    let invalidCount = 0;

    const checkUrlQuick = (url: string): Promise<boolean> => {
      return new Promise(resolve => {
        https
          .get(
            url,
            {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              timeout: 5000,
            },
            (res: any) => {
              if (res.statusCode === 404 || res.statusCode === 410) {
                resolve(false);
              } else {
                resolve(true);
              }
            }
          )
          .on('error', () => resolve(false))
          .on('timeout', () => resolve(false));
      });
    };

    // Validar em paralelo (batches de 10)
    const invalidIds: string[] = [];
    for (let i = 0; i < vehiclesToValidate.length; i += 10) {
      const batch = vehiclesToValidate.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async v => ({
          id: v.id,
          valid: await checkUrlQuick(v.url || ''),
        }))
      );
      results.filter(r => !r.valid).forEach(r => invalidIds.push(r.id));
    }

    if (invalidIds.length > 0) {
      await prisma.vehicle.updateMany({
        where: { id: { in: invalidIds } },
        data: { disponivel: false },
      });
      invalidCount = invalidIds.length;
    }

    // 2. Scraping bÃ¡sico (primeiras 3 pÃ¡ginas para rapidez)
    logger.info('ðŸš€ Passo 2/2: Scraping rÃ¡pido...');

    const baseUrl = 'https://robustcar.com.br';
    const fetchPage = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        https
          .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res: any) => {
            let data = '';
            res.on('data', (chunk: string) => (data += chunk));
            res.on('end', () => resolve(data));
          })
          .on('error', reject);
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

    logger.info({ invalidCount, newVehicles, finalCount }, 'âœ… Admin: Refresh concluÃ­do');

    res.json({
      success: true,
      message: 'Refresh do inventÃ¡rio concluÃ­do',
      summary: {
        urlsInvalidated: invalidCount,
        potentialNewVehicles: newVehicles,
        totalAvailable: finalCount,
      },
      note:
        newVehicles > 0
          ? `Encontrados ${newVehicles} novos veÃ­culos. Execute /admin/scrape-robustcar para importÃ¡-los.`
          : 'InventÃ¡rio atualizado, sem novos veÃ­culos.',
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: Refresh falhou');
    res.status(500).json({
      success: false,
      error: 'Refresh falhou',
      details: error.message,
    });
  }
});

/**
 * GET /admin/debug-vehicles
 * Mostra estatÃ­sticas dos veÃ­culos no banco para debug
 */
router.get('/debug-vehicles', requireSecret, async (req, res) => {
  try {
    // Total de veÃ­culos
    const total = await prisma.vehicle.count();
    const available = await prisma.vehicle.count({ where: { disponivel: true } });

    // Agrupar por carroceria
    const byBodyType = await prisma.vehicle.groupBy({
      by: ['carroceria'],
      _count: true,
      where: { disponivel: true },
      orderBy: { _count: { carroceria: 'desc' } },
    });

    // Buscar pickups especificamente (case insensitive nÃ£o funciona no groupBy)
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
        ],
      },
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        carroceria: true,
        disponivel: true,
        preco: true,
      },
    });

    // Listar todos os valores Ãºnicos de carroceria
    const allBodyTypes = await prisma.vehicle.findMany({
      where: { disponivel: true },
      select: { carroceria: true },
      distinct: ['carroceria'],
    });

    res.json({
      success: true,
      summary: {
        total,
        available,
        byBodyType: byBodyType.map(b => ({ type: b.carroceria, count: b._count })),
      },
      uniqueBodyTypes: allBodyTypes.map(b => b.carroceria),
      pickupsFound: pickups.length,
      pickups: pickups.map(p => ({
        id: p.id,
        name: `${p.marca} ${p.modelo} ${p.ano}`,
        carroceria: p.carroceria,
        disponivel: p.disponivel,
        preco: p.preco,
      })),
    });
  } catch (error: any) {
    logger.error({ error }, 'âŒ Admin: Debug vehicles failed');
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint de verificacao basica
router.get('/health/endpoints', requireSecret, (_req, res) => {
  res.json({
    status: 'ok',
    auth: 'Use header x-admin-secret: <SEED_SECRET> or Authorization: Bearer <SEED_SECRET>',
    endpoints: {
      seed: 'GET /admin/seed-robustcar',
      schemaPush: 'POST /admin/schema-push',
      updateUber: 'POST /admin/update-uber',
      vehiclesUber: 'GET /admin/vehicles-uber?type=x',
      validateUrls: 'POST /admin/validate-urls',
      scrapeRobustcar: 'POST /admin/scrape-robustcar',
      refreshInventory: 'POST /admin/refresh-inventory',
      debugVehicles: 'GET /admin/debug-vehicles',
      debug: 'GET /admin/debug-env',
    },
  });
});

// Endpoint de debug (verificar ambiente)
router.get('/debug-env', requireSecret, async (_req, res) => {
  try {
    const { existsSync, readdirSync } = await import('fs');
    const { join } = await import('path');

    const cwd = process.cwd();
    const jsonPath = join(cwd, 'scripts', 'robustcar-vehicles.json');
    const seedPath = join(cwd, 'prisma', 'seed-robustcar.ts');

    const scriptsFiles = existsSync(join(cwd, 'scripts')) ? readdirSync(join(cwd, 'scripts')) : [];
    const prismaFiles = existsSync(join(cwd, 'prisma')) ? readdirSync(join(cwd, 'prisma')) : [];

    res.json({
      cwd,
      paths: {
        json: jsonPath,
        jsonExists: existsSync(jsonPath),
        seed: seedPath,
        seedExists: existsSync(seedPath),
      },
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? 'âœ… Configurado' : 'âŒ NÃ£o configurado',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'âœ… Configurado' : 'âŒ NÃ£o configurado',
        NODE_ENV: process.env.NODE_ENV,
      },
      files: {
        scripts: scriptsFiles.filter(l => l.includes('robustcar')),
        prisma: prismaFiles.filter(l => l.includes('seed')),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * GET /admin/metrics
 * Returns aggregated business metrics for dashboard
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '24h')
 */
router.get('/metrics', requireSecret, async (req, res) => {
  try {
    const period = (req.query.period as MetricsPeriod) || '24h';

    if (!['24h', '7d', '30d'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Use: 24h, 7d, or 30d',
      });
    }

    logger.info({ period }, 'Admin: Getting metrics');
    const metrics = await metricsService.getMetrics(period);

    res.json({
      success: true,
      ...metrics,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      details: error.message,
    });
  }
});

/**
 * GET /admin/metrics/performance
 * Returns performance and health metrics (vehicles, embeddings, active conversations)
 */
router.get('/metrics/performance', requireSecret, async (req, res) => {
  try {
    const performance = await metricsService.getPerformanceMetrics();

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      ...performance,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get performance metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics',
      details: error.message,
    });
  }
});

/**
 * GET /admin/metrics/trend
 * Returns daily metrics trend for the last N days
 * Query params:
 *   - days: number (default: 7)
 */
router.get('/metrics/trend', requireSecret, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const trend = await metricsService.getDailyTrend(days);

    res.json({
      success: true,
      days,
      trend,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get daily trend');
    res.status(500).json({
      success: false,
      error: 'Failed to get daily trend',
      details: error.message,
    });
  }
});

/**
 * GET /admin/health
 * System health check endpoint
 */
router.get('/health', async (req, res) => {
  const checks: Record<string, { status: string; details?: any }> = {};
  let overallStatus = 'healthy';

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch (error: any) {
    checks.database = { status: 'error', details: error.message };
    overallStatus = 'unhealthy';
  }

  // Check vehicles count
  try {
    const vehiclesCount = await prisma.vehicle.count({ where: { disponivel: true } });
    const vehiclesWithEmbeddings = await prisma.vehicle.count({
      where: { disponivel: true, embedding: { not: null } },
    });
    checks.vehicles = {
      status: vehiclesCount > 0 ? 'ok' : 'warning',
      details: {
        available: vehiclesCount,
        withEmbeddings: vehiclesWithEmbeddings,
        coverage:
          vehiclesCount > 0
            ? `${((vehiclesWithEmbeddings / vehiclesCount) * 100).toFixed(1)}%`
            : '0%',
      },
    };
  } catch (error: any) {
    checks.vehicles = { status: 'error', details: error.message };
  }

  // Check LLM providers configuration
  checks.llm = {
    status: process.env.OPENAI_API_KEY ? 'ok' : 'warning',
    details: {
      primary: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      fallback: process.env.GROQ_API_KEY ? 'configured' : 'missing',
    },
  };

  // Check WhatsApp configuration
  checks.whatsapp = {
    status: process.env.META_WHATSAPP_TOKEN ? 'ok' : 'warning',
    details: {
      metaToken: process.env.META_WHATSAPP_TOKEN ? 'configured' : 'missing',
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ? 'configured' : 'missing',
    },
  };

  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /admin/alerts
 * Returns recent alerts from the alerting system
 * Query params:
 *   - limit: number (default: 20)
 *   - severity: 'info' | 'warning' | 'critical' (optional filter)
 */
router.get('/alerts', requireSecret, async (req, res) => {
  try {
    const { AlertService } = await import('../lib/alerts');
    const limit = parseInt(req.query.limit as string) || 20;
    const severity = req.query.severity as string;

    let alerts;
    if (severity && ['info', 'warning', 'critical'].includes(severity)) {
      alerts = AlertService.getBySeverity(severity as 'info' | 'warning' | 'critical');
    } else {
      alerts = AlertService.getRecent(limit);
    }

    const counts = AlertService.getCounts();

    res.json({
      success: true,
      counts,
      alerts,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get alerts');
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      details: error.message,
    });
  }
});

// ============================================================================
// Recommendation Accuracy Endpoints
// ============================================================================

/**
 * GET /admin/recommendations/accuracy
 * Returns recommendation accuracy metrics (Precision@K, CTR, MRR, etc)
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/accuracy', requireSecret, async (req, res) => {
  try {
    const { recommendationMetrics } = await import('../services/recommendation-metrics.service');
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    if (!['24h', '7d', '30d'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Use: 24h, 7d, or 30d',
      });
    }

    const metrics = await recommendationMetrics.calculateMetrics(period);

    res.json({
      success: true,
      ...metrics,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get recommendation accuracy');
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendation accuracy',
      details: error.message,
    });
  }
});

/**
 * GET /admin/recommendations/worst
 * Returns worst performing recommendations for analysis
 * Query params:
 *   - limit: number (default: 10)
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/worst', requireSecret, async (req, res) => {
  try {
    const { recommendationMetrics } = await import('../services/recommendation-metrics.service');
    const limit = parseInt(req.query.limit as string) || 10;
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    const worst = await recommendationMetrics.getWorstPerformingRecommendations(limit, period);

    res.json({
      success: true,
      count: worst.length,
      recommendations: worst,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get worst recommendations');
    res.status(500).json({
      success: false,
      error: 'Failed to get worst recommendations',
      details: error.message,
    });
  }
});

/**
 * GET /admin/recommendations/score-analysis
 * Analyzes correlation between matchScore and actual engagement
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/score-analysis', requireSecret, async (req, res) => {
  try {
    const { recommendationMetrics } = await import('../services/recommendation-metrics.service');
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    const analysis = await recommendationMetrics.analyzeScoreAccuracy(period);

    res.json({
      success: true,
      period,
      analysis,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to analyze score accuracy');
    res.status(500).json({
      success: false,
      error: 'Failed to analyze score accuracy',
      details: error.message,
    });
  }
});

/**
 * GET /admin/recommendations/by-segment
 * Returns metrics by use-case segment (uber, family, travel, work)
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/by-segment', requireSecret, async (req, res) => {
  try {
    const { recommendationMetrics } = await import('../services/recommendation-metrics.service');
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    const segments = ['uber', 'familia', 'viagem', 'trabalho', 'geral'];
    const results = await Promise.all(
      segments.map(async segment => ({
        segment,
        metrics: await recommendationMetrics.calculateMetricsBySegment(segment, period),
      }))
    );

    res.json({
      success: true,
      period,
      segments: results,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get metrics by segment');
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics by segment',
      details: error.message,
    });
  }
});

// ============================================================================
// Failure Analysis Endpoints
// ============================================================================

/**
 * GET /admin/recommendations/failure-patterns
 * Detects recurring failure patterns in recommendations
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/failure-patterns', requireSecret, async (req, res) => {
  try {
    const { recommendationAnalysis } = await import('../services/recommendation-analysis.service');
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    const patterns = await recommendationAnalysis.detectFailurePatterns(period);

    res.json({
      success: true,
      period,
      count: patterns.length,
      patterns,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get failure patterns');
    res.status(500).json({
      success: false,
      error: 'Failed to get failure patterns',
      details: error.message,
    });
  }
});

/**
 * GET /admin/recommendations/suggestions
 * Returns improvement suggestions based on failure patterns
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/suggestions', requireSecret, async (req, res) => {
  try {
    const { recommendationAnalysis } = await import('../services/recommendation-analysis.service');
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    const suggestions = await recommendationAnalysis.suggestImprovements(period);

    res.json({
      success: true,
      period,
      count: suggestions.length,
      suggestions,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to get suggestions');
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
      details: error.message,
    });
  }
});

/**
 * GET /admin/recommendations/compare
 * Compares recommendation metrics between two dates
 * Query params:
 *   - beforeDate: ISO date string
 *   - afterDate: ISO date string
 */
router.get('/recommendations/compare', requireSecret, async (req, res) => {
  try {
    const { recommendationAnalysis } = await import('../services/recommendation-analysis.service');

    const beforeDate = req.query.beforeDate
      ? new Date(req.query.beforeDate as string)
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

    const afterDate = req.query.afterDate
      ? new Date(req.query.afterDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const comparison = await recommendationAnalysis.compareVersions(beforeDate, afterDate);

    res.json({
      success: true,
      comparison,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to compare versions');
    res.status(500).json({
      success: false,
      error: 'Failed to compare versions',
      details: error.message,
    });
  }
});

/**
 * GET /admin/recommendations/report
 * Generates comprehensive analysis report
 * Query params:
 *   - period: '24h' | '7d' | '30d' (default: '7d')
 */
router.get('/recommendations/report', requireSecret, async (req, res) => {
  try {
    const { recommendationAnalysis } = await import('../services/recommendation-analysis.service');
    const period = (req.query.period as '24h' | '7d' | '30d') || '7d';

    const report = await recommendationAnalysis.generateReport(period);

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    logger.error({ error }, 'Admin: Failed to generate report');
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
      details: error.message,
    });
  }
});

export default router;
