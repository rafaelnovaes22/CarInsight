/**
 * Script para validar URLs e refazer scraping da RobustCar
 * - Valida se as páginas não estão vazias (404, página removida, etc)
 * - Atualiza o banco apenas com veículos válidos
 */

import https from 'https';
import fs from 'fs';

// Configurações
const CONFIG = {
  baseUrl: 'https://robustcar.com.br',
  searchUrl: 'https://robustcar.com.br/busca//pag/',
  maxPages: 6,
  delayBetweenRequests: 500, // ms entre requisições
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// Mapeamento de modelos para categorias
const CATEGORY_MAP = {
  // SUVs
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
  KORANDO: 'SUV',
  PAJERO: 'SUV',
  'T-CROSS': 'SUV',
  TCROSS: 'SUV',
  AIRCROSS: 'SUV',
  STONIC: 'SUV',
  KICKS: 'SUV',
  CAPTUR: 'SUV',
  EXP10: 'SUV',
  IX35: 'SUV',
  'GRAND LIVINA': 'SUV',
  FREEMONT: 'SUV',
  NIVUS: 'SUV',
  TAOS: 'SUV',
  TERRITORY: 'SUV',
  BRONCO: 'SUV',

  // Sedans
  CIVIC: 'SEDAN',
  COROLLA: 'SEDAN',
  CITY: 'SEDAN',
  CRUZE: 'SEDAN',
  HB20S: 'SEDAN',
  SENTRA: 'SEDAN',
  LOGAN: 'SEDAN',
  VOYAGE: 'SEDAN',
  FOCUS: 'SEDAN',
  PRIUS: 'SEDAN',
  ARRIZO: 'SEDAN',
  VERSA: 'SEDAN',
  VIRTUS: 'SEDAN',
  CRONOS: 'SEDAN',
  'ONIX PLUS': 'SEDAN',
  PRISMA: 'SEDAN',

  // Hatches
  ONIX: 'HATCH',
  HB20: 'HATCH',
  FIESTA: 'HATCH',
  KA: 'HATCH',
  CELTA: 'HATCH',
  UNO: 'HATCH',
  PALIO: 'HATCH',
  FOX: 'HATCH',
  MOBI: 'HATCH',
  KWID: 'HATCH',
  ETIOS: 'HATCH',
  YARIS: 'HATCH',
  C3: 'HATCH',
  207: 'HATCH',
  PUNTO: 'HATCH',
  POLO: 'HATCH',
  GOL: 'HATCH',
  ARGO: 'HATCH',
  SANDERO: 'HATCH',
  MARCH: 'HATCH',

  // Pickups
  TORO: 'PICKUP',
  STRADA: 'PICKUP',
  SAVEIRO: 'PICKUP',
  MONTANA: 'PICKUP',
  HILUX: 'PICKUP',
  S10: 'PICKUP',
  RANGER: 'PICKUP',
  AMAROK: 'PICKUP',
  FRONTIER: 'PICKUP',
  OROCH: 'PICKUP',
  MAVERICK: 'PICKUP',
  TRITON: 'PICKUP',
  RAM: 'PICKUP',

  // Minivans
  SPIN: 'MINIVAN',
  MERIVA: 'MINIVAN',
  IDEA: 'MINIVAN',
  LIVINA: 'MINIVAN',
  SPACEFOX: 'MINIVAN',
  CARNIVAL: 'MINIVAN',
  ZAFIRA: 'MINIVAN',
};

function detectCategory(brand, model) {
  const modelUpper = model.toUpperCase();
  const brandUpper = brand.toUpperCase();

  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (modelUpper.includes(key)) return category;
  }

  // Default based on brand patterns
  if (brandUpper.includes('FIAT') && modelUpper.includes('TORO')) return 'PICKUP';
  if (modelUpper.includes('PLUS') || modelUpper.includes('SEDAN')) return 'SEDAN';

  return 'HATCH'; // default
}

function parsePrice(priceText) {
  if (!priceText || priceText.includes('Consulte') || priceText.includes('consulte')) return null;
  const cleaned = priceText
    .replace(/R\$|\./g, '')
    .replace(',', '.')
    .trim();
  const price = parseFloat(cleaned);
  return price > 0 ? price : null;
}

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 15000,
    };

    https
      .get(url, options, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            return fetchPage(
              redirectUrl.startsWith('http') ? redirectUrl : `${CONFIG.baseUrl}${redirectUrl}`
            )
              .then(resolve)
              .catch(reject);
          }
        }

        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, html: data }));
      })
      .on('error', reject)
      .on('timeout', () => reject(new Error('Timeout')));
  });
}

/**
 * Valida se uma URL de veículo está funcionando e a página não está vazia
 */
async function validateVehicleUrl(url) {
  try {
    const result = await fetchPage(url);

    // Verificar status HTTP
    if (result.status === 404 || result.status === 410) {
      return { valid: false, reason: `HTTP ${result.status}` };
    }

    // Verificar se a página tem conteúdo de veículo
    const html = result.html.toLowerCase();

    // Indicadores de página válida
    const hasVehicleInfo =
      html.includes('ficha técnica') ||
      html.includes('características') ||
      html.includes('detalhes do veículo') ||
      html.includes('quilometragem') ||
      (html.includes('ano') && html.includes('câmbio'));

    // Indicadores de página inválida
    const isError =
      html.includes('página não encontrada') ||
      html.includes('veículo não disponível') ||
      html.includes('anúncio não encontrado') ||
      html.includes('404') ||
      html.includes('não existe') ||
      html.includes('vendido') ||
      (html.length < 5000 && !hasVehicleInfo); // Página muito pequena sem info

    if (isError) {
      return { valid: false, reason: 'Página inválida ou veículo indisponível' };
    }

    if (!hasVehicleInfo && html.length < 10000) {
      return { valid: false, reason: 'Conteúdo insuficiente' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

function extractVehiclesFromHtml(html) {
  const vehicles = [];

  // Regex mais robusto para extrair veículos
  const vehicleBlocks = html.split(/<h3[^>]*class="[^"]*titulo[^"]*"/).slice(1);

  for (const block of vehicleBlocks) {
    try {
      // Extrair URL
      const urlMatch = block.match(/href="([^"]+)"/);
      if (!urlMatch) continue;

      const url = urlMatch[1];

      // Extrair título (ano marca modelo)
      const titleMatch = block.match(/>(\d{4})\s+(\w+(?:\s+\w+)?)\s+([^<]+)</);
      if (!titleMatch) continue;

      const [_, yearFromTitle, brand, modelVersion] = titleMatch;

      // Extrair dados da lista
      const listItems = block.match(/<li>([^<]+)<\/li>/g) || [];
      const listData = listItems.map(li => li.replace(/<\/?li>/g, '').trim());

      // Extrair preço
      const priceMatch = block.match(/class="preco"[^>]*>([^<]+)/);
      const price = priceMatch ? parsePrice(priceMatch[1]) : null;

      // Parse model and version
      const mvParts = modelVersion.trim().split(/\s+/);
      const model = mvParts[0];
      const version = mvParts.slice(1).join(' ');

      // Extrair dados da lista (combustível, cor, ano, km)
      const fuel = listData[0] || 'FLEX';
      const color = listData[1] || 'N/I';
      const year = parseInt(listData[2]) || parseInt(yearFromTitle);
      const mileage = parseInt((listData[3] || '0').replace(/\./g, '')) || 0;

      const fullUrl = url.startsWith('http') ? url : `${CONFIG.baseUrl}${url}`;

      vehicles.push({
        brand: brand.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        version: version.trim(),
        year,
        mileage,
        fuel: fuel.toUpperCase(),
        color: color.toUpperCase(),
        price,
        detailUrl: fullUrl,
        category: detectCategory(brand, model),
      });
    } catch (e) {
      // Skip malformed entries
    }
  }

  return vehicles;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeRobustCar() {
  console.log('🚀 Iniciando scraping da RobustCar...\n');
  console.log(`📍 URL base: ${CONFIG.searchUrl}`);
  console.log(`📄 Máximo de páginas: ${CONFIG.maxPages}\n`);

  const allVehicles = [];

  for (let page = 1; page <= CONFIG.maxPages; page++) {
    const url = `${CONFIG.searchUrl}${page}/ordem/ano-desc/`;
    console.log(`📥 Página ${page}/${CONFIG.maxPages}...`);

    try {
      const result = await fetchPage(url);

      if (result.status !== 200) {
        console.log(`   ⚠️  Status ${result.status}, pulando...`);
        continue;
      }

      const vehicles = extractVehiclesFromHtml(result.html);

      if (vehicles.length === 0) {
        console.log(`   ⚠️  Nenhum veículo encontrado (fim do catálogo)`);
        break;
      }

      allVehicles.push(...vehicles);
      console.log(`   ✅ ${vehicles.length} veículos extraídos`);

      await sleep(CONFIG.delayBetweenRequests);
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }

  console.log(`\n📊 Total extraído: ${allVehicles.length} veículos`);

  return allVehicles;
}

async function validateAllVehicles(vehicles) {
  console.log('\n🔍 Validando URLs dos veículos...\n');

  const validVehicles = [];
  const invalidVehicles = [];

  let processed = 0;
  const total = vehicles.length;

  for (const vehicle of vehicles) {
    processed++;
    process.stdout.write(`\r   Validando ${processed}/${total}...`);

    const validation = await validateVehicleUrl(vehicle.detailUrl);

    if (validation.valid) {
      validVehicles.push(vehicle);
    } else {
      invalidVehicles.push({
        vehicle: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
        url: vehicle.detailUrl,
        reason: validation.reason,
      });
    }

    await sleep(200); // Delay entre validações para não sobrecarregar
  }

  console.log('\n');
  console.log(`   ✅ Válidos: ${validVehicles.length}`);
  console.log(`   ❌ Inválidos: ${invalidVehicles.length}`);

  if (invalidVehicles.length > 0) {
    console.log('\n📋 Veículos com URLs inválidas:');
    invalidVehicles.slice(0, 10).forEach(v => {
      console.log(`   - ${v.vehicle}: ${v.reason}`);
    });
    if (invalidVehicles.length > 10) {
      console.log(`   ... e mais ${invalidVehicles.length - 10}`);
    }
  }

  return { valid: validVehicles, invalid: invalidVehicles };
}

function printSummary(vehicles) {
  console.log('\n📊 Resumo por Categoria:');

  const byCategory = vehicles.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {});

  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} veículos`);
    });

  console.log('\n📊 Resumo por Marca:');

  const byBrand = vehicles.reduce((acc, v) => {
    acc[v.brand] = (acc[v.brand] || 0) + 1;
    return acc;
  }, {});

  Object.entries(byBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([brand, count]) => {
      console.log(`   ${brand}: ${count}`);
    });

  const withPrice = vehicles.filter(v => v.price !== null).length;
  console.log(`\n💰 Com preço: ${withPrice}/${vehicles.length}`);
}

// Main execution
async function main() {
  console.log('═'.repeat(60));
  console.log('   ROBUSTCAR SCRAPER + VALIDADOR DE URLs');
  console.log('═'.repeat(60) + '\n');

  // 1. Fazer scraping
  const scrapedVehicles = await scrapeRobustCar();

  if (scrapedVehicles.length === 0) {
    console.log('\n❌ Nenhum veículo encontrado no scraping!');
    process.exit(1);
  }

  // 2. Validar URLs
  const { valid: validVehicles, invalid: invalidVehicles } =
    await validateAllVehicles(scrapedVehicles);

  if (validVehicles.length === 0) {
    console.log('\n❌ Nenhum veículo com URL válida!');
    process.exit(1);
  }

  // 3. Mostrar resumo
  printSummary(validVehicles);

  // 4. Salvar arquivo JSON
  const outputPath = './scripts/robustcar-vehicles-validated.json';
  fs.writeFileSync(outputPath, JSON.stringify(validVehicles, null, 2));
  console.log(`\n💾 Salvo em: ${outputPath}`);

  // 5. Salvar inválidos para referência
  if (invalidVehicles.length > 0) {
    const invalidPath = './scripts/robustcar-vehicles-invalid.json';
    fs.writeFileSync(invalidPath, JSON.stringify(invalidVehicles, null, 2));
    console.log(`📋 URLs inválidas: ${invalidPath}`);
  }

  // 6. Mostrar exemplo
  console.log('\n📋 Exemplo de veículo válido:');
  console.log(JSON.stringify(validVehicles[0], null, 2));

  console.log('\n' + '═'.repeat(60));
  console.log(`   ✅ Scraping finalizado: ${validVehicles.length} veículos válidos`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
