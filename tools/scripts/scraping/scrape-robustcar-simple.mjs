import https from 'https';
import fs from 'fs';
import path from 'path';

const CATEGORY_MAP = {
  CRETA: 'SUV',
  COMPASS: 'SUV',
  RENEGADE: 'SUV',
  TRACKER: 'SUV',
  ECOSPORT: 'SUV',
  DUSTER: 'SUV',
  'HR-V': 'SUV',
  TUCSON: 'SUV',
  SPORTAGE: 'SUV',
  RAV4: 'SUV',
  TIGGO: 'SUV',
  KORANDO: 'SUV',
  PAJERO: 'SUV',
  'T-CROSS': 'SUV',
  AIRCROSS: 'SUV',
  STONIC: 'SUV',
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
  TORO: 'PICKUP',
  STRADA: 'PICKUP',
  'GRAND LIVINA': 'SUV',
  FREEMONT: 'SUV',
  MERIVA: 'MINIVAN',
  IDEA: 'MINIVAN',
  SOUL: 'HATCH',
  NEO: 'MOTO',
};

function detectCategory(model) {
  const modelUpper = model.toUpperCase();
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (modelUpper.includes(key)) return category;
  }
  return 'HATCH';
}

function parsePrice(priceText) {
  if (priceText.includes('Consulte')) return null;
  const cleaned = priceText
    .replace(/R\$|\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(cleaned) || null;
}

function extractVehicles(html) {
  const vehicles = [];
  const regex =
    /<h3[^>]*>.*?<a[^>]+href="([^"]+)"[^>]*>(\d{4})\s+(\w+)\s+([^<]+)<\/a>.*?<ul[^>]*>.*?<li>([^<]+)<\/li>.*?<li>([^<]+)<\/li>.*?<li>(\d{4})<\/li>.*?<li>([\d.]+)<\/li>.*?<h4[^>]*class="preco"[^>]*>([^<]+)<\/h4>/gs;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const [_, url, yearTitle, brand, modelVersion, fuel, color, year, km, price] = match;

    const modelParts = modelVersion.trim().split(' ');
    const model = modelParts[0];
    const version = modelParts.slice(1).join(' ');

    vehicles.push({
      brand: brand.trim(),
      model: model.trim(),
      version: version.trim(),
      year: parseInt(year) || parseInt(yearTitle),
      mileage: parseInt(km.replace(/\./g, '')) || 0,
      fuel: fuel.trim(),
      color: color.trim(),
      price: parsePrice(price),
      detailUrl: `https://robustcar.com.br${url}`,
      category: detectCategory(model),
    });
  }

  return vehicles;
}

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function scrapeAllPages() {
  console.log('🚀 Iniciando scraping da Robust Car...\n');

  const allVehicles = [];
  const baseUrl = 'https://robustcar.com.br/busca//pag/';

  for (let page = 1; page <= 4; page++) {
    console.log(`📥 Scraping página ${page}...`);
    try {
      const html = await fetchPage(`${baseUrl}${page}/ordem/ano-desc/`);
      const vehicles = extractVehicles(html);
      allVehicles.push(...vehicles);
      console.log(`✅ Página ${page}: ${vehicles.length} veículos`);

      if (page < 4) await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`❌ Erro página ${page}:`, error.message);
    }
  }

  console.log(`\n✅ Total: ${allVehicles.length} veículos\n`);

  const counts = allVehicles.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Categorias:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));

  return allVehicles;
}

const vehicles = await scrapeAllPages();

const outputPath = './scripts/robustcar-vehicles.json';
fs.writeFileSync(outputPath, JSON.stringify(vehicles, null, 2));

console.log(`\n💾 Salvo em: ${outputPath}`);
console.log('\n📋 Exemplo:');
console.log(JSON.stringify(vehicles[0], null, 2));
