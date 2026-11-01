/**
 * Scraper Dinamico + Sincronizacao de Estoque - Renatinhu's Cars
 *
 * Descobre automaticamente todos os veiculos da pagina de estoque,
 * busca detalhes de cada um, salva JSON e sincroniza com o banco de dados.
 *
 * Uso: npm run stock:sync
 *      (ou: npx tsx scripts/scrape-and-sync-renatinhu.mjs)
 */

import https from 'https';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// ───────────────────────────────────────────────────────────
// Configuracoes
// ───────────────────────────────────────────────────────────

const CONFIG = {
  baseUrl: 'https://ssl9212.websiteseguro.com',
  stockPath: '/armazena1/atw_site/site/atw6944b/Estoque.aspx?nu=-1',
  detailPath: '/armazena1/atw_site/site/atw6944b/Detalhes.aspx',
  siteUrl: 'https://www.renatinhuscars.com.br',
  photoBaseUrl: 'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos',
  delayBetweenRequests: 500,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const OUTPUT_PATH = './tools/scripts/scraping/renatinhu-vehicles-full.json';

// ───────────────────────────────────────────────────────────
// Utilitarios
// ───────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': CONFIG.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000,
    };

    https
      .get(url, options, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            const fullUrl = redirectUrl.startsWith('http')
              ? redirectUrl
              : `${CONFIG.baseUrl}${redirectUrl}`;
            return fetchPage(fullUrl).then(resolve).catch(reject);
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

// ───────────────────────────────────────────────────────────
// Mapeamentos
// ───────────────────────────────────────────────────────────

const BODY_TYPE_MAP = {
  SUV: [
    'creta',
    'kicks',
    'captur',
    'duster',
    'evoque',
    'journey',
    't-cross',
    'nivus',
    'tracker',
    'tiggo',
    'corolla cross',
    'compass',
    'renegade',
    'tucson',
    'sportage',
    'hr-v',
    'hrv',
    'rav4',
    'ecosport',
    'gla',
  ],
  Sedan: [
    'civic',
    'corolla',
    'city',
    'cruze',
    'cobalt',
    'prisma',
    'siena',
    'corsa sedan',
    '528',
    '320i',
    'sentra',
    'jetta',
    'virtus',
    'cronos',
    'hb20s',
    'logan',
    'versa',
    'yaris sedan',
    'onix plus',
    'santana',
  ],
  Hatch: [
    '125i',
    'onix',
    'fox',
    'fit',
    'fiesta',
    'fusca',
    'corsa 1.0',
    'polo',
    'gol',
    'hb20',
    'sandero',
    'kwid',
    'mobi',
    'argo',
    'ka',
    'up!',
    'i30',
    'c3',
  ],
  Picape: ['strada', 'saveiro', 'pick-up', 'toro', 'montana', 'hilux', 's10', 'ranger', 'amarok'],
  Moto: ['pcx', 'maxsym', 'cb', 'cg', 'factor', 'fazer', 'ninja', 'mt-'],
  Perua: ['variant', 'sw'],
  Minivan: ['doblo', 'spin', 'livina'],
};

const CATEGORY_FLAGS = {
  SUV: { aptoFamilia: true, aptoTrabalho: false, aptoCarga: false, aptoUsoDiario: true },
  Sedan: { aptoFamilia: true, aptoTrabalho: false, aptoCarga: false, aptoUsoDiario: true },
  Hatch: { aptoFamilia: false, aptoTrabalho: false, aptoCarga: false, aptoUsoDiario: true },
  Picape: { aptoFamilia: false, aptoTrabalho: true, aptoCarga: true, aptoUsoDiario: false },
  Moto: { aptoFamilia: false, aptoTrabalho: false, aptoCarga: false, aptoUsoDiario: false },
  Perua: { aptoFamilia: true, aptoTrabalho: false, aptoCarga: false, aptoUsoDiario: true },
  Minivan: { aptoFamilia: true, aptoTrabalho: false, aptoCarga: false, aptoUsoDiario: true },
};

// ───────────────────────────────────────────────────────────
// Funcoes de parsing
// ───────────────────────────────────────────────────────────

// Modelos que existem tanto na versao Hatch quanto Sedan —
// a classificacao depende do nome completo do veiculo.
const AMBIGUOUS_MODELS = ['etios', 'yaris', 'corsa', 'onix'];

function detectBodyType(nome) {
  const nomeLower = nome.toLowerCase();

  // 1. Indicadores explícitos no nome completo têm prioridade absoluta
  if (/\bsedan\b/.test(nomeLower)) return 'Sedan';
  if (/\bhatch\b/.test(nomeLower)) return 'Hatch';
  if (/\bsuv\b/.test(nomeLower)) return 'SUV';
  if (/\bpicape\b|\bpick[- ]?up\b/.test(nomeLower)) return 'Picape';
  if (/\bminivan\b/.test(nomeLower)) return 'Minivan';

  // 2. Para modelos ambíguos, checar se a versão indica a variante
  const isAmbiguous = AMBIGUOUS_MODELS.some(m => nomeLower.includes(m));
  if (isAmbiguous) {
    // Etios Sedan tem "sedan" no nome — se não tiver, é hatch
    // Yaris Sedan idem
    // Onix Plus = Sedan; Onix sem "plus" = Hatch
    if (nomeLower.includes('onix') && nomeLower.includes('plus')) return 'Sedan';
    if (nomeLower.includes('yaris') && !nomeLower.includes('sedan')) return 'Hatch';
    if (nomeLower.includes('corsa') && nomeLower.includes('1.0')) return 'Hatch';
    // Etios: sem "sedan" no nome = Hatch
    if (nomeLower.includes('etios') && !nomeLower.includes('sedan')) return 'Hatch';
    if (nomeLower.includes('etios') && nomeLower.includes('sedan')) return 'Sedan';
  }

  // 3. Lookup pela tabela de modelos conhecidos
  for (const [bodyType, keywords] of Object.entries(BODY_TYPE_MAP)) {
    if (keywords.some(kw => nomeLower.includes(kw))) {
      return bodyType;
    }
  }

  return 'Hatch';
}

function parseVehicleName(nome) {
  const parts = nome.trim().split(/\s+/);
  const year = parseInt(parts[parts.length - 1]);
  let marca = parts[0].toUpperCase();
  let modelo = parts[1]?.toUpperCase() || '';
  let versaoStart = 2;

  // Marcas compostas
  if (marca === 'LAND' && parts[1]?.toLowerCase() === 'rover') {
    marca = 'LAND ROVER';
    modelo = parts[2]?.toUpperCase() || 'EVOQUE';
    versaoStart = 3;
  }
  if (marca === 'CAOA' && parts[1]?.toLowerCase() === 'chery') {
    marca = 'CAOA CHERY';
    modelo = parts[2]?.toUpperCase() || '';
    versaoStart = 3;
  }
  if (marca === 'MERCEDES-BENZ') {
    // Modelo eh a segunda parte (ex: GLA)
    modelo = parts[1]?.toUpperCase() || '';
    versaoStart = 2;
  }

  // Modelos compostos: COROLLA CROSS, COROLLA VERSO, etc.
  const COMPOUND_MODELS = [
    ['corolla', 'cross'],
    ['corolla', 'verso'],
  ];
  for (const [m1, m2] of COMPOUND_MODELS) {
    if (modelo.toLowerCase() === m1 && parts[versaoStart]?.toLowerCase() === m2) {
      modelo = `${m1.toUpperCase()} ${m2.toUpperCase()}`;
      versaoStart++;
      break;
    }
  }

  const versao = parts.slice(versaoStart, -1).join(' ').toUpperCase();
  return { marca, modelo, versao, ano: isNaN(year) ? 0 : year };
}

function parsePrice(text) {
  if (!text) return null;
  const match = text.match(/R\$\s*([\d.,]+)/);
  if (match) {
    const cleaned = match[1].replace(/\./g, '').replace(',', '.');
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : value;
  }
  return null;
}

function parseKm(text) {
  if (!text) return 0;
  const match = text.match(/([\d.]+)/);
  if (match) {
    return parseInt(match[1].replace(/\./g, '')) || 0;
  }
  return 0;
}

// ───────────────────────────────────────────────────────────
// Etapa 1: Descoberta dinamica de veiculos
// ───────────────────────────────────────────────────────────

async function discoverVehicles() {
  console.log('\n--- Etapa 1: Descobrindo veiculos na pagina de estoque ---\n');

  const stockUrl = `${CONFIG.baseUrl}${CONFIG.stockPath}`;
  const result = await fetchPage(stockUrl);

  if (result.status !== 200) {
    throw new Error(`Erro ao acessar pagina de estoque: HTTP ${result.status}`);
  }

  const html = result.html;
  const vehicles = [];
  const seen = new Set();

  // Extrair veiculos do pattern Det(ID, "MODELO") — site usa aspas duplas e + como separador
  // Preferir a versao lowercase (que inclui ano) quando disponivel
  const detRegex = /Det\((\d+),\s*"([^"]+)"\)/gi;
  let match;
  while ((match = detRegex.exec(html)) !== null) {
    const id = parseInt(match[1]);
    const rawNome = match[2].trim();
    const nome = rawNome.replace(/\+/g, ' ').toLowerCase();

    // Preferir versao com ano (lowercase, termina em digitos)
    if (!seen.has(id)) {
      seen.add(id);
      vehicles.push({ id, nome });
    } else if (/\d{4}$/.test(nome)) {
      // Atualizar com versao que tem ano
      const idx = vehicles.findIndex(v => v.id === id);
      if (idx !== -1) vehicles[idx].nome = nome;
    }
  }

  // Dividir HTML por cards de veículo — cada card começa com a classe listing-list-loop
  // Isso evita contaminação de dados entre veículos adjacentes
  const priceMap = {};
  const kmMap = {};
  const combustivelMap = {};
  const cambioMap = {};
  const fotoMap = {};

  // Separar cada card pelo seu delimitador CSS
  const cardDelimiter = "<div class='listing-list-loop'>";
  const cardChunks = html.split(cardDelimiter);

  for (const chunk of cardChunks) {
    // Encontrar o ID do veículo neste card (qualquer Det(ID, ...))
    const idMatch = chunk.match(/Det\((\d+),/);
    if (!idMatch) continue;
    const vehicleId = parseInt(idMatch[1]);

    // Preco — usar apenas este card
    const precoMatch = chunk.match(/R\$\s*([\d.,]+)/);
    if (precoMatch) {
      priceMap[vehicleId] = parsePrice(`R$ ${precoMatch[1]}`);
    }

    // KM — priorizar o campo "Quilometragem" explícito dentro do card
    const kmExplicit =
      chunk.match(/Quilometragem<\/div><\/div><div class='value[^']*'>([\d.,\s]+)\s*Km/i) ||
      chunk.match(/class='value[^']*'>([\d.,]+)\s*Km/i) ||
      chunk.match(/Quilometragem[\s\S]{0,200}?>([\d.,]+)\s*Km/i);
    if (kmExplicit) {
      kmMap[vehicleId] = parseKm(kmExplicit[1]);
    }

    // Combustivel — campo explícito no card
    const combMatch =
      chunk.match(/Combust[ií]vel[\s\S]{0,200}?class='value[^']*'>([^<]+)</i) ||
      chunk.match(/Combust[ií]vel[:\s]*([A-Za-zÀ-ú]+)/i);
    if (combMatch) {
      combustivelMap[vehicleId] = combMatch[1].trim();
    }

    // Cambio — campo explícito no card
    const cambioMatch =
      chunk.match(/C[aâ]mbio[\s\S]{0,200}?class='value[^']*'>([^<]+)</i) ||
      chunk.match(/C[aâ]mbio[:\s]*([A-Za-zÀ-ú]+)/i);
    if (cambioMatch) {
      cambioMap[vehicleId] = cambioMatch[1].trim();
    }

    // Foto — apenas a foto deste card
    const fotoMatch = chunk.match(/<img[^>]+src=["']([^"']*394_\d+[^"']*\.jpg)["']/i);
    if (fotoMatch) {
      let fotoUrl = fotoMatch[1];
      if (fotoUrl.startsWith('//')) fotoUrl = 'https:' + fotoUrl;
      else if (!fotoUrl.startsWith('http')) fotoUrl = CONFIG.baseUrl + '/' + fotoUrl;
      fotoMap[vehicleId] = fotoUrl;
    }
  }

  console.log(`Encontrados ${vehicles.length} veiculos na pagina de estoque`);

  return { vehicles, priceMap, kmMap, combustivelMap, cambioMap, fotoMap };
}

// ───────────────────────────────────────────────────────────
// Etapa 2: Buscar detalhes de cada veiculo
// ───────────────────────────────────────────────────────────

function extractOpcionais(html) {
  const opcionais = [];
  const opcionaisSection = html.match(/Opcionais[\s\S]*?<\/ul>/i);

  if (opcionaisSection) {
    const items = opcionaisSection[0].matchAll(/<li[^>]*>([^<]+)<\/li>/gi);
    for (const m of items) {
      const item = m[1].trim();
      if (item && !item.includes('Opcionais') && item.length > 2) {
        opcionais.push(item);
      }
    }
  }

  const knownOpcionais = [
    'AIR BAG',
    'AIRBAG',
    'ABS',
    'FREIOS ABS',
    'AR CONDICIONADO',
    'DIREÇÃO HIDRÁULICA',
    'DIREÇÃO ELÉTRICA',
    'VIDROS ELÉTRICOS',
    'TRAVAS ELÉTRICAS',
    'TRAVA ELÉTRICA',
    'ALARME',
    'CÂMBIO AUTOMÁTICO',
    'RODAS DE LIGA LEVE',
    'BANCOS EM COURO',
    'SENSOR DE ESTACIONAMENTO',
    'CÂMERA DE RÉ',
    'TETO SOLAR',
    'CENTRAL MULTIMÍDIA',
    'BLUETOOTH',
    'COMPUTADOR DE BORDO',
    'PILOTO AUTOMÁTICO',
    'RETROVISORES ELÉTRICOS',
    'RADIO AM/FM',
    'USB',
  ];

  const htmlLower = html.toLowerCase();
  for (const opcional of knownOpcionais) {
    if (htmlLower.includes(opcional.toLowerCase()) && !opcionais.includes(opcional)) {
      opcionais.push(opcional);
    }
  }

  return [...new Set(opcionais)];
}

function detectCambio(nome, opcionais, htmlHint) {
  const nomeLower = nome.toLowerCase();

  if (
    nomeLower.includes('xtronic') ||
    nomeLower.includes('cvt') ||
    nomeLower.includes('x-tronic') ||
    nomeLower.includes('automatico') ||
    nomeLower.includes('automático')
  ) {
    return 'Automático';
  }

  if (htmlHint) {
    const hintLower = htmlHint.toLowerCase();
    if (hintLower === 'automático' || hintLower === 'automatico' || hintLower === 'automatic') {
      return 'Automático';
    }
  }

  if (
    opcionais.some(
      o => o.toLowerCase().includes('automatico') || o.toLowerCase().includes('automático')
    )
  ) {
    return 'Automático';
  }

  const autoModels = [
    'civic',
    'corolla',
    'cruze',
    'city',
    'captur',
    'evoque',
    't-cross',
    'nivus',
    'creta',
    'kicks',
    '528',
    '125i',
    '320i',
    'fit',
    'journey',
    'tiggo',
    'corolla cross',
    'gla',
    'sportage',
  ];
  if (autoModels.some(m => nomeLower.includes(m))) {
    return 'Automático';
  }

  return 'Manual';
}

function detectCombustivel(nome, ano, htmlHint) {
  if (htmlHint) {
    const hintLower = htmlHint.toLowerCase();
    if (hintLower.includes('diesel')) return 'Diesel';
    if (hintLower.includes('gasolina')) return 'Gasolina';
    if (hintLower.includes('flex')) return 'Flex';
    if (hintLower.includes('elétrico') || hintLower.includes('eletrico')) return 'Elétrico';
  }

  if (ano < 2003) return 'Gasolina';
  const nomeLower = nome.toLowerCase();
  if (nomeLower.includes('diesel')) return 'Diesel';
  if (
    nomeLower.includes('125i') ||
    nomeLower.includes('528') ||
    nomeLower.includes('320i') ||
    nomeLower.includes('evoque')
  )
    return 'Gasolina';
  return 'Flex';
}

function extractDetailsFromHtml(html) {
  const details = { preco: null, km: 0, cor: 'Consulte', opcionais: [] };

  // Preco
  const precoMatch = html.match(/Valor[:\s]*R\$\s*([\d.,]+)/i) || html.match(/R\$\s*([\d.,]+)/);
  if (precoMatch) {
    details.preco = parsePrice(`R$ ${precoMatch[1]}`);
  }

  // KM
  const kmMatch =
    html.match(/Quilometragem[:\s]*([\d.]+)/i) ||
    html.match(/KM[:\s]*([\d.]+)/i) ||
    html.match(/([\d.]+)\s*km/i);
  if (kmMatch) {
    details.km = parseKm(kmMatch[1]);
  }

  // Cor
  const corMatch = html.match(/Cor[:\s]*([A-Za-zÀ-ú\s]+?)(?:<|,|\n)/i);
  if (corMatch) {
    const cor = corMatch[1].trim();
    if (cor.length > 1 && cor.length < 30) {
      details.cor = cor;
    }
  }

  // Opcionais
  details.opcionais = extractOpcionais(html);

  return details;
}

function generatePhotoUrls(id, count = 5) {
  const urls = [];
  for (let i = 1; i <= count; i++) {
    urls.push(`${CONFIG.photoBaseUrl}/394_${id}_${i}-1.jpg`);
  }
  return urls;
}

function generateDetailUrl(vehicle) {
  const nomeForUrl = vehicle.nome
    .replace(/\s+\d{4}$/, '')
    .replace(/ /g, '+')
    .toUpperCase();
  return `${CONFIG.siteUrl}/?veiculo=${encodeURIComponent(nomeForUrl)}&id=${vehicle.id}`;
}

async function fetchVehicleDetails(discovered) {
  console.log('\n--- Etapa 2: Buscando detalhes de cada veiculo ---\n');

  const { vehicles, priceMap, kmMap, combustivelMap, cambioMap, fotoMap } = discovered;
  const results = [];
  let processed = 0;

  for (const vehicle of vehicles) {
    processed++;
    process.stdout.write(
      `\r   ${processed}/${vehicles.length}: ${vehicle.nome.substring(0, 40)}...          `
    );

    const parsed = parseVehicleName(vehicle.nome);
    let detailData = { preco: null, km: 0, cor: 'Consulte', opcionais: [] };

    // Buscar pagina de detalhes
    try {
      const detailUrl = `${CONFIG.baseUrl}${CONFIG.detailPath}?id=${vehicle.id}`;
      const result = await fetchPage(detailUrl);
      if (result.status === 200 && result.html.length > 500) {
        detailData = extractDetailsFromHtml(result.html);
      }
    } catch (error) {
      // Silenciar erro, usar dados da pagina de estoque
    }

    // Priorizar dados da pagina de detalhes, fallback para dados do estoque
    const preco = detailData.preco || priceMap[vehicle.id] || null;

    // KM: usar detail page; fallback para dados do estoque (parsing por card isolado)
    let km = detailData.km || kmMap[vehicle.id] || 0;
    const opcionais = detailData.opcionais;

    const cambio = detectCambio(vehicle.nome, opcionais, cambioMap[vehicle.id]);
    const combustivel = detectCombustivel(vehicle.nome, parsed.ano, combustivelMap[vehicle.id]);
    const carroceria = detectBodyType(vehicle.nome);

    let portas = 4;
    if (vehicle.nome.includes('2p')) portas = 2;

    // Usar apenas foto encontrada no HTML do card; se ausente, null (excluído nas buscas)
    const fotoUrl = fotoMap[vehicle.id] || null;

    results.push({
      id: vehicle.id,
      marca: parsed.marca,
      modelo: parsed.modelo,
      versao: parsed.versao,
      ano: parsed.ano,
      km,
      preco,
      cor: detailData.cor,
      combustivel,
      cambio,
      portas,
      carroceria,
      fotoUrl,
      fotosUrls: generatePhotoUrls(vehicle.id),
      detailUrl: generateDetailUrl(vehicle),
      opcionais,
      arCondicionado: opcionais.some(o => o.toLowerCase().includes('ar condicionado')),
      direcaoHidraulica: opcionais.some(o => o.toLowerCase().includes('direção')),
      airbag: opcionais.some(
        o => o.toLowerCase().includes('air bag') || o.toLowerCase().includes('airbag')
      ),
      abs: opcionais.some(o => o.toLowerCase().includes('abs')),
      vidroEletrico: opcionais.some(o => o.toLowerCase().includes('vidros elétricos')),
      travaEletrica: opcionais.some(o => o.toLowerCase().includes('trava')),
      alarme: opcionais.some(o => o.toLowerCase().includes('alarme')),
      rodaLigaLeve: opcionais.some(o => o.toLowerCase().includes('liga leve')),
      som: opcionais.some(
        o => o.toLowerCase().includes('radio') || o.toLowerCase().includes('multimídia')
      ),
      descricao: `${parsed.marca} ${parsed.modelo} ${parsed.versao} ${parsed.ano}`.trim(),
      nomeCompleto: vehicle.nome.replace(/\b\w/g, l => l.toUpperCase()),
    });

    await sleep(CONFIG.delayBetweenRequests);
  }

  console.log('\n');
  return results;
}

// ───────────────────────────────────────────────────────────
// Etapa 3: Salvar JSON
// ───────────────────────────────────────────────────────────

function saveJson(vehicles) {
  console.log('--- Etapa 3: Salvando JSON ---\n');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vehicles, null, 2), 'utf-8');
  console.log(`   Salvo em ${OUTPUT_PATH} (${vehicles.length} veiculos)\n`);
}

// ───────────────────────────────────────────────────────────
// Etapa 4: Sincronizar com banco de dados
// ───────────────────────────────────────────────────────────

function checkUberEligibility(vehicle) {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.ano;

  const isUberXEligible =
    vehicleAge <= 10 &&
    (vehicle.carroceria === 'Sedan' || vehicle.carroceria === 'Hatch') &&
    vehicle.carroceria !== 'Moto';

  const premiumBrands = ['BMW', 'MERCEDES', 'AUDI', 'LEXUS', 'VOLVO', 'JAGUAR', 'LAND ROVER'];
  const executiveModels = ['COROLLA', 'CIVIC', 'CRUZE', 'SENTRA', 'FUSION', 'JETTA'];

  const isPremiumBrand = premiumBrands.some(b => vehicle.marca.includes(b));
  const isExecutiveModel = executiveModels.some(m => vehicle.modelo.includes(m));

  const isUberBlackEligible =
    vehicleAge <= 5 && (isPremiumBrand || isExecutiveModel || vehicle.carroceria === 'SUV');

  return { aptoUber: isUberXEligible, aptoUberBlack: isUberBlackEligible };
}

async function syncDatabase(vehicles) {
  console.log('--- Etapa 4: Sincronizando com banco de dados ---\n');

  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    for (const vehicle of vehicles) {
      try {
        const uber = checkUberEligibility(vehicle);
        const flags = CATEGORY_FLAGS[vehicle.carroceria] || {};

        const vehicleData = {
          externalId: String(vehicle.id),
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          versao: vehicle.versao || '',
          ano: vehicle.ano,
          km: vehicle.km,
          preco: vehicle.preco || 0,
          cor: vehicle.cor || 'Consulte',
          carroceria: vehicle.carroceria,
          combustivel: vehicle.combustivel,
          cambio: vehicle.cambio,
          portas: vehicle.portas,
          fotoUrl: vehicle.fotoUrl,
          fotosUrls: vehicle.fotosUrls.join(','),
          url: vehicle.detailUrl,
          detailUrl: vehicle.detailUrl,
          descricao: vehicle.descricao,
          opcionais: vehicle.opcionais.join(', '),
          disponivel: true,
          // Flags de opcionais
          arCondicionado: vehicle.arCondicionado,
          direcaoHidraulica: vehicle.direcaoHidraulica,
          airbag: vehicle.airbag,
          abs: vehicle.abs,
          vidroEletrico: vehicle.vidroEletrico,
          travaEletrica: vehicle.travaEletrica,
          alarme: vehicle.alarme,
          rodaLigaLeve: vehicle.rodaLigaLeve,
          som: vehicle.som,
          // Flags de aptidao
          aptoUber: uber.aptoUber,
          aptoUberBlack: uber.aptoUberBlack,
          aptoFamilia: flags.aptoFamilia || false,
          aptoTrabalho: flags.aptoTrabalho || false,
          aptoCarga: flags.aptoCarga || false,
          aptoUsoDiario: flags.aptoUsoDiario || false,
          // Limpar embedding para regeneracao
          embeddingModel: null,
          embeddingGeneratedAt: null,
        };

        // Upsert por externalId
        const existing = await prisma.vehicle.findUnique({
          where: { externalId: String(vehicle.id) },
        });

        if (existing) {
          await prisma.vehicle.update({
            where: { id: existing.id },
            data: vehicleData,
          });
          updated++;
        } else {
          await prisma.vehicle.create({ data: vehicleData });
          created++;
        }

        process.stdout.write(`\r   Processados: ${created + updated + errors}/${vehicles.length}`);
      } catch (error) {
        errors++;
        console.error(`\n   Erro: ${vehicle.marca} ${vehicle.modelo}: ${error.message}`);
      }
    }

    console.log('\n');
    console.log(`   Criados: ${created}`);
    console.log(`   Atualizados: ${updated}`);
    if (errors > 0) console.log(`   Erros: ${errors}`);

    // Marcar veiculos que nao apareceram como indisponiveis
    const scrapedExternalIds = vehicles.map(v => String(v.id));
    const outdatedResult = await prisma.vehicle.updateMany({
      where: {
        externalId: { notIn: scrapedExternalIds },
        disponivel: true,
        // So marcar veiculos que tem externalId (foram importados via scraper)
        NOT: { externalId: null },
      },
      data: { disponivel: false },
    });

    if (outdatedResult.count > 0) {
      console.log(
        `   ${outdatedResult.count} veiculo(s) marcado(s) como indisponivel (saiu do site)`
      );
    }

    // Resumo final do banco
    const total = await prisma.vehicle.count({ where: { disponivel: true } });
    const byCategory = await prisma.vehicle.groupBy({
      by: ['carroceria'],
      where: { disponivel: true },
      _count: true,
    });

    console.log(`\n   Total disponivel no banco: ${total} veiculos`);
    byCategory.forEach(c => {
      console.log(`   ${c.carroceria || 'N/I'}: ${c._count}`);
    });
  } finally {
    await prisma.$disconnect();
  }
}

// ───────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log("   RENATINHU'S CARS - SCRAPER DINAMICO + SYNC");
  console.log('='.repeat(60));

  // Etapa 1: Descoberta
  const discovered = await discoverVehicles();

  if (discovered.vehicles.length === 0) {
    console.error('\nNenhum veiculo encontrado na pagina de estoque!');
    process.exit(1);
  }

  // Etapa 2: Detalhes
  const vehicles = await fetchVehicleDetails(discovered);

  // Resumo
  console.log('Resumo por Marca:');
  const byBrand = vehicles.reduce((acc, v) => {
    acc[v.marca] = (acc[v.marca] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byBrand)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => console.log(`   ${brand}: ${count}`));

  console.log('\nResumo por Carroceria:');
  const byBody = vehicles.reduce((acc, v) => {
    acc[v.carroceria] = (acc[v.carroceria] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byBody)
    .sort((a, b) => b[1] - a[1])
    .forEach(([body, count]) => console.log(`   ${body}: ${count}`));

  const withPrice = vehicles.filter(v => v.preco !== null);
  console.log(`\nCom preco: ${withPrice.length}/${vehicles.length}`);
  if (withPrice.length > 0) {
    const prices = withPrice.map(v => v.preco);
    console.log(
      `Faixa: R$ ${Math.min(...prices).toLocaleString('pt-BR')} - R$ ${Math.max(...prices).toLocaleString('pt-BR')}`
    );
  }

  // Etapa 3: Salvar JSON
  saveJson(vehicles);

  // Etapa 4: Sync com banco
  const skipDb = process.argv.includes('--no-db');
  if (skipDb) {
    console.log('--- Etapa 4: Pulada (--no-db) ---\n');
  } else {
    await syncDatabase(vehicles);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`   Finalizado: ${vehicles.length} veiculos processados`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
