/**
 * Scraper Automatizado para Renatinhu's Cars
 * Extrai todos os veículos do site com informações detalhadas
 * 
 * Uso: node scripts/scrape-renatinhu-auto.mjs
 */

import https from 'https';
import fs from 'fs';

// Configurações
const CONFIG = {
  baseUrl: 'https://ssl9212.websiteseguro.com',
  stockPath: '/armazena1/atw_site/site/atw6944b/Estoque.aspx?nu=-1',
  detailPath: '/armazena1/atw_site/site/atw6944b/Detalhes.aspx',
  siteUrl: 'https://www.renatinhuscars.com.br',
  photoBaseUrl: 'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos',
  delayBetweenRequests: 800,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Lista de veículos extraída do site em 2025-12-10
const VEHICLES_LIST = [
  {"id":661,"nome":"bmw 125i 2.0 m sport 16v 4p 2014"},
  {"id":772,"nome":"bmw 528 2.0 16v 4p 2014"},
  {"id":760,"nome":"chevrolet cobalt 1.8 mpfi ltz 8v 4p 2016"},
  {"id":771,"nome":"chevrolet corsa 1.0 efi wind 8v 4p 1999"},
  {"id":607,"nome":"chevrolet corsa 1.6 mpfi st cs pick-up 8v 2p 2003"},
  {"id":748,"nome":"chevrolet corsa 1.8 mpfi sedan 8v 4p 2003"},
  {"id":749,"nome":"chevrolet cruze 1.8 lt 16v 4p 2012"},
  {"id":727,"nome":"chevrolet onix 1.0 ls mt 4p 2016"},
  {"id":670,"nome":"chevrolet prisma 1.0 mpfi vhce maxx 8v 4p 2010"},
  {"id":688,"nome":"dafra maxsym 400i  2016"},
  {"id":691,"nome":"dodge journey 3.6 rt v6 24v 4p 2013"},
  {"id":773,"nome":"fiat doblo 1.8 mpi advent 16v 4p 2012"},
  {"id":745,"nome":"fiat doblo 1.8 mpi essence 7l 16v 4p 2017"},
  {"id":732,"nome":"fiat siena el 1.0 4p 2013"},
  {"id":708,"nome":"fiat strada 1.8 mpi advent ce 8v 2p 2010"},
  {"id":769,"nome":"ford fiesta 1.0 mpi class 8v 4p 2010"},
  {"id":715,"nome":"honda city 1.5 lx 16v 4p 2016"},
  {"id":759,"nome":"honda city 1.5 lx 16v 4p 2013"},
  {"id":682,"nome":"honda civic 1.8 lxs 16v 4p 2010"},
  {"id":766,"nome":"honda civic 2.0 lxr 16v 4p 2015"},
  {"id":770,"nome":"honda fit 1.5 ex 16v 4p 2014"},
  {"id":768,"nome":"honda fit 1.5 lx 16v 4p 2015"},
  {"id":684,"nome":"honda pcx 150 2021"},
  {"id":761,"nome":"hyundai creta 1.6 16v attitude 4p 2019"},
  {"id":765,"nome":"land rover evoque dynamic 5d  2.0 4p 2015"},
  {"id":767,"nome":"nissan kicks 1.6 16vstart advance xtronic 4p 2024"},
  {"id":679,"nome":"renault captur 1.6 16v sce intense x-tronic 4p 2019"},
  {"id":725,"nome":"renault duster 2.0 16v dynamique 4p 2016"},
  {"id":757,"nome":"toyota corolla 2.0 xei 16v 4p 2016"},
  {"id":758,"nome":"volkswagen fox cl 1.6 4p 2016"},
  {"id":351,"nome":"volkswagen fusca 1300 2p 1975"},
  {"id":733,"nome":"volkswagen nivus 1.0 200 tsi total highline 4p 2025"},
  {"id":763,"nome":"volkswagen polo 1.6 mi sportline 8v 4p 2007"},
  {"id":756,"nome":"volkswagen saveiro 1.6 cl cs 8v 2p 1995"},
  {"id":740,"nome":"volkswagen t-cross 1.4 250 tsi total highline 4p 2025"},
  {"id":628,"nome":"volkswagen variant 1.6 8v 2p 1973"}
];

// Mapeamento de carroceria
const BODY_TYPE_MAP = {
  'SUV': ['creta', 'kicks', 'captur', 'duster', 'evoque', 'journey', 't-cross', 'nivus', 'doblo'],
  'Sedan': ['civic', 'corolla', 'city', 'cruze', 'cobalt', 'prisma', 'siena', 'corsa sedan', '528'],
  'Hatch': ['125i', 'onix', 'fox', 'fit', 'fiesta', 'fusca', 'corsa 1.0', 'corsa 1.8 mpfi sedan'],
  'Picape': ['strada', 'saveiro', 'pick-up'],
  'Moto': ['pcx', 'maxsym'],
  'Perua': ['variant'],
};

function detectBodyType(nome) {
  const nomeLower = nome.toLowerCase();
  for (const [bodyType, keywords] of Object.entries(BODY_TYPE_MAP)) {
    if (keywords.some(kw => nomeLower.includes(kw))) {
      return bodyType;
    }
  }
  return 'Hatch'; // default
}

function parseVehicleName(nome) {
  const parts = nome.trim().split(' ');
  const year = parseInt(parts[parts.length - 1]);
  const marca = parts[0].toUpperCase();
  
  // Encontrar o modelo (segunda palavra geralmente)
  let modelo = parts[1]?.toUpperCase() || '';
  
  // Cases especiais
  if (marca === 'LAND' && parts[1]?.toLowerCase() === 'rover') {
    return {
      marca: 'LAND ROVER',
      modelo: parts[2]?.toUpperCase() || 'EVOQUE',
      versao: parts.slice(3, -1).join(' ').toUpperCase(),
      ano: year
    };
  }
  
  // Versão é o resto menos o ano
  const versao = parts.slice(2, -1).join(' ').toUpperCase();
  
  return { marca, modelo, versao, ano: year };
}

function parsePrice(text) {
  if (!text) return null;
  const match = text.match(/R\$\s*([\d.,]+)/);
  if (match) {
    const cleaned = match[1].replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned);
  }
  return null;
}

function parseKm(text) {
  if (!text) return 0;
  const match = text.match(/([\d.]+)/);
  if (match) {
    return parseInt(match[1].replace(/\./g, ''));
  }
  return 0;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000
    };

    https.get(url, options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${CONFIG.baseUrl}${redirectUrl}`;
          return fetchPage(fullUrl).then(resolve).catch(reject);
        }
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });
}

function extractDetailsFromHtml(html, vehicle) {
  const details = {
    preco: null,
    km: 0,
    cor: 'N/I',
    combustivel: 'Flex',
    cambio: 'Manual',
    portas: 4,
    opcionais: [],
  };

  // Extrair preço
  const precoMatch = html.match(/Valor[:\s]*R\$\s*([\d.,]+)/i) || 
                      html.match(/R\$\s*([\d.,]+)/);
  if (precoMatch) {
    details.preco = parsePrice(`R$ ${precoMatch[1]}`);
  }

  // Extrair KM
  const kmMatch = html.match(/KM[:\s]*([\d.]+)/i) || 
                   html.match(/Quilometragem[:\s]*([\d.]+)/i) ||
                   html.match(/([\d.]+)\s*km/i);
  if (kmMatch) {
    details.km = parseKm(kmMatch[1]);
  }

  // Extrair Cor
  const corMatch = html.match(/Cor[:\s]*([A-Za-zÀ-ú]+)/i);
  if (corMatch) {
    details.cor = corMatch[1].trim();
  }

  // Extrair Combustível
  const combMatch = html.match(/Combustível[:\s]*([A-Za-zÀ-ú]+)/i) ||
                     html.match(/Combust[ií]vel[:\s]*([A-Za-zÀ-ú]+)/i);
  if (combMatch) {
    details.combustivel = combMatch[1].trim();
  } else if (html.toLowerCase().includes('gasolina')) {
    details.combustivel = 'Gasolina';
  } else if (html.toLowerCase().includes('diesel')) {
    details.combustivel = 'Diesel';
  }

  // Extrair Câmbio
  if (html.toLowerCase().includes('automático') || html.toLowerCase().includes('automatico')) {
    details.cambio = 'Automático';
  } else if (html.toLowerCase().includes('cvt')) {
    details.cambio = 'Automático';
  }

  // Extrair Portas
  const portasMatch = html.match(/(\d)\s*portas?/i);
  if (portasMatch) {
    details.portas = parseInt(portasMatch[1]);
  } else if (vehicle.nome.includes('2p')) {
    details.portas = 2;
  } else if (vehicle.nome.includes('4p')) {
    details.portas = 4;
  }

  // Extrair opcionais comuns
  const opcionaisKeywords = [
    'Ar Condicionado', 'Direção Hidráulica', 'Direção Elétrica',
    'Vidros Elétricos', 'Travas Elétricas', 'Airbag', 'ABS',
    'Alarme', 'Som', 'Rodas de Liga', 'Sensor de Estacionamento',
    'Câmera de Ré', 'Teto Solar', 'Bancos em Couro', 'Central Multimídia',
    'Bluetooth', 'USB', 'Piloto Automático', 'Controle de Tração'
  ];

  for (const opcional of opcionaisKeywords) {
    if (html.toLowerCase().includes(opcional.toLowerCase())) {
      details.opcionais.push(opcional);
    }
  }

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
  const nomeEncoded = vehicle.nome.replace(/ /g, '+').replace(/\+\d{4}$/, '');
  return `${CONFIG.siteUrl}/?veiculo=${encodeURIComponent(nomeEncoded.toUpperCase())}&id=${vehicle.id}`;
}

async function scrapeVehicleDetails(vehicle) {
  const parsed = parseVehicleName(vehicle.nome);
  const detailUrl = `${CONFIG.baseUrl}${CONFIG.detailPath}?id=${vehicle.id}`;
  
  let details = {
    preco: null,
    km: 0,
    cor: 'N/I',
    combustivel: 'Flex',
    cambio: 'Manual',
    portas: 4,
    opcionais: [],
  };

  try {
    const result = await fetchPage(detailUrl);
    if (result.status === 200 && result.html.length > 1000) {
      details = extractDetailsFromHtml(result.html, vehicle);
    }
  } catch (error) {
    console.log(`   ⚠️ Erro ao buscar detalhes: ${error.message}`);
  }

  // Determinar câmbio pelo modelo (alguns modelos são geralmente automáticos)
  const autoModels = ['civic', 'corolla', 'cruze', 'city', 'captur', 'evoque', 't-cross', 'nivus', 'creta', 'kicks', '528', '125i', 'fit'];
  if (autoModels.some(m => vehicle.nome.toLowerCase().includes(m))) {
    if (details.cambio === 'Manual') {
      // Verificar se há indicação de automático no modelo
      if (vehicle.nome.toLowerCase().includes('xtronic') || 
          vehicle.nome.toLowerCase().includes('cvt') ||
          vehicle.nome.toLowerCase().includes('at') ||
          parsed.versao?.toLowerCase().includes('at')) {
        details.cambio = 'Automático';
      }
    }
  }

  return {
    id: vehicle.id,
    marca: parsed.marca,
    modelo: parsed.modelo,
    versao: parsed.versao,
    ano: parsed.ano,
    km: details.km,
    preco: details.preco,
    cor: details.cor,
    combustivel: details.combustivel,
    cambio: details.cambio,
    portas: details.portas,
    carroceria: detectBodyType(vehicle.nome),
    fotoUrl: `${CONFIG.photoBaseUrl}/394_${vehicle.id}_1-1.jpg`,
    fotosUrls: generatePhotoUrls(vehicle.id),
    detailUrl: generateDetailUrl(vehicle),
    opcionais: details.opcionais,
    descricao: `${parsed.marca} ${parsed.modelo} ${parsed.versao} ${parsed.ano}`,
    nomeCompleto: vehicle.nome.replace(/\b\w/g, l => l.toUpperCase()),
  };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('   RENATINHU\'S CARS - SCRAPER AUTOMATIZADO');
  console.log('═'.repeat(60));
  console.log(`\n📊 Total de veículos a processar: ${VEHICLES_LIST.length}\n`);

  const vehicles = [];
  let processed = 0;

  for (const vehicle of VEHICLES_LIST) {
    processed++;
    process.stdout.write(`\r🔄 Processando ${processed}/${VEHICLES_LIST.length}: ${vehicle.nome.substring(0, 30)}...`);

    try {
      const fullVehicle = await scrapeVehicleDetails(vehicle);
      vehicles.push(fullVehicle);
    } catch (error) {
      console.log(`\n❌ Erro em ${vehicle.nome}: ${error.message}`);
    }

    await sleep(CONFIG.delayBetweenRequests);
  }

  console.log('\n');

  // Resumo por marca
  console.log('📊 Resumo por Marca:');
  const byBrand = vehicles.reduce((acc, v) => {
    acc[v.marca] = (acc[v.marca] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byBrand)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand, count]) => console.log(`   ${brand}: ${count}`));

  // Resumo por carroceria
  console.log('\n📊 Resumo por Carroceria:');
  const byBody = vehicles.reduce((acc, v) => {
    acc[v.carroceria] = (acc[v.carroceria] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byBody)
    .sort((a, b) => b[1] - a[1])
    .forEach(([body, count]) => console.log(`   ${body}: ${count}`));

  // Veículos com/sem preço
  const withPrice = vehicles.filter(v => v.preco !== null);
  console.log(`\n💰 Com preço: ${withPrice.length}/${vehicles.length}`);

  // Salvar JSON
  const outputPath = './scripts/renatinhu-vehicles.json';
  fs.writeFileSync(outputPath, JSON.stringify(vehicles, null, 2), 'utf-8');
  console.log(`\n💾 Dados salvos em: ${outputPath}`);

  // Exemplo
  console.log('\n📋 Exemplo de veículo:');
  console.log(JSON.stringify(vehicles[0], null, 2));

  console.log('\n' + '═'.repeat(60));
  console.log(`   ✅ Scraping finalizado: ${vehicles.length} veículos`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
