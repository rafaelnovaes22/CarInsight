/**
 * Scraper Genérico para Sites de Concessionárias
 * 
 * Este script pode ser adaptado para diferentes sites.
 * Configure os seletores CSS e a URL base para cada cliente.
 * 
 * Uso:
 *   npx tsx scripts/generic-scraper.ts --config scripts/clients/[cliente].config.json
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Interface para configuração do scraper
interface ScraperConfig {
  clientId: string;
  clientName: string;
  baseUrl: string;
  inventoryUrl: string;
  paginationPattern?: string; // ex: "/pag/{page}/"
  maxPages: number;
  
  // Seletores CSS
  selectors: {
    vehicleCard: string;
    title?: string;
    brand?: string;
    model?: string;
    version?: string;
    year?: string;
    mileage?: string;
    fuel?: string;
    color?: string;
    price?: string;
    detailUrl?: string;
    image?: string;
  };
  
  // Mapeamento de campos (se precisar de transformação)
  fieldTransforms?: {
    [key: string]: (value: string) => any;
  };
}

// Interface de veículo padronizada
interface VehicleData {
  brand: string;
  model: string;
  version: string;
  year: number;
  mileage: number;
  fuel: string;
  color: string;
  price: number | null;
  detailUrl: string;
  imageUrl?: string;
  category: string;
}

// Mapeamento de categorias por modelo
const CATEGORY_MAP: Record<string, string> = {
  // SUVs
  'CRETA': 'SUV', 'COMPASS': 'SUV', 'RENEGADE': 'SUV', 'TRACKER': 'SUV',
  'ECOSPORT': 'SUV', 'DUSTER': 'SUV', 'HR-V': 'SUV', 'HRV': 'SUV',
  'TUCSON': 'SUV', 'SPORTAGE': 'SUV', 'RAV4': 'SUV', 'TIGGO': 'SUV',
  'T-CROSS': 'SUV', 'TCROSS': 'SUV', 'KICKS': 'SUV', 'CAPTUR': 'SUV',
  'NIVUS': 'SUV', 'TAOS': 'SUV', 'TIGUAN': 'SUV', 'TERRITORY': 'SUV',
  'BRONCO': 'SUV', 'COMMANDER': 'SUV', 'PULSE': 'SUV', 'FASTBACK': 'SUV',
  
  // Sedans
  'CIVIC': 'SEDAN', 'COROLLA': 'SEDAN', 'CITY': 'SEDAN', 'CRUZE': 'SEDAN',
  'HB20S': 'SEDAN', 'SENTRA': 'SEDAN', 'LOGAN': 'SEDAN', 'VOYAGE': 'SEDAN',
  'VIRTUS': 'SEDAN', 'CRONOS': 'SEDAN', 'VERSA': 'SEDAN', 'YARIS SEDAN': 'SEDAN',
  
  // Hatches
  'ONIX': 'HATCH', 'HB20': 'HATCH', 'FIESTA': 'HATCH', 'KA': 'HATCH',
  'CELTA': 'HATCH', 'UNO': 'HATCH', 'PALIO': 'HATCH', 'FOX': 'HATCH',
  'MOBI': 'HATCH', 'KWID': 'HATCH', 'ETIOS': 'HATCH', 'YARIS': 'HATCH',
  'POLO': 'HATCH', 'GOL': 'HATCH', 'ARGO': 'HATCH', 'SANDERO': 'HATCH',
  
  // Pickups
  'TORO': 'PICKUP', 'STRADA': 'PICKUP', 'HILUX': 'PICKUP', 'S10': 'PICKUP',
  'RANGER': 'PICKUP', 'AMAROK': 'PICKUP', 'FRONTIER': 'PICKUP', 'MONTANA': 'PICKUP',
  'OROCH': 'PICKUP', 'SAVEIRO': 'PICKUP', 'MAVERICK': 'PICKUP', 'TITAN': 'PICKUP',
  
  // Minivans / Utilitários
  'SPIN': 'MINIVAN', 'LIVINA': 'MINIVAN', 'ZAFIRA': 'MINIVAN',
  'FIORINO': 'UTILITARIO', 'KANGOO': 'UTILITARIO', 'DOBLO': 'UTILITARIO',
};

function detectCategory(model: string): string {
  const modelUpper = model.toUpperCase().trim();
  
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (modelUpper.includes(key)) {
      return category;
    }
  }
  
  return 'OUTROS';
}

function parsePrice(priceText: string): number | null {
  if (!priceText || priceText.toLowerCase().includes('consulte')) {
    return null;
  }
  
  const cleanPrice = priceText
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  
  const price = parseFloat(cleanPrice);
  return isNaN(price) ? null : price;
}

function parseMileage(kmText: string): number {
  if (!kmText) return 0;
  const clean = kmText.replace(/[.\s]/g, '').replace('km', '').trim();
  return parseInt(clean, 10) || 0;
}

function parseYear(yearText: string): number {
  if (!yearText) return new Date().getFullYear();
  const match = yearText.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
}

async function scrapePage(config: ScraperConfig, pageNumber: number): Promise<VehicleData[]> {
  let url = config.inventoryUrl;
  
  if (config.paginationPattern && pageNumber > 1) {
    url = url + config.paginationPattern.replace('{page}', pageNumber.toString());
  } else if (pageNumber > 1) {
    url = `${url}?page=${pageNumber}`;
  }
  
  console.log(`📥 Scraping página ${pageNumber}: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 30000,
    });
    
    const $ = cheerio.load(response.data);
    const vehicles: VehicleData[] = [];
    const { selectors } = config;
    
    $(selectors.vehicleCard).each((_, element) => {
      const $el = $(element);
      
      try {
        // Extrai dados usando os seletores configurados
        const title = selectors.title ? $el.find(selectors.title).text().trim() : '';
        const brand = selectors.brand ? $el.find(selectors.brand).text().trim() : '';
        const model = selectors.model ? $el.find(selectors.model).text().trim() : '';
        const version = selectors.version ? $el.find(selectors.version).text().trim() : '';
        const year = selectors.year ? $el.find(selectors.year).text().trim() : '';
        const mileage = selectors.mileage ? $el.find(selectors.mileage).text().trim() : '';
        const fuel = selectors.fuel ? $el.find(selectors.fuel).text().trim() : 'Flex';
        const color = selectors.color ? $el.find(selectors.color).text().trim() : '';
        const priceText = selectors.price ? $el.find(selectors.price).text().trim() : '';
        
        let detailUrl = '';
        if (selectors.detailUrl) {
          const href = $el.find(selectors.detailUrl).attr('href') || $el.find('a').first().attr('href');
          detailUrl = href?.startsWith('http') ? href : `${config.baseUrl}${href}`;
        }
        
        let imageUrl = '';
        if (selectors.image) {
          imageUrl = $el.find(selectors.image).attr('src') || $el.find(selectors.image).attr('data-src') || '';
        }
        
        // Parse dos valores
        const vehicle: VehicleData = {
          brand: brand || title.split(' ')[0] || 'N/A',
          model: model || title.split(' ')[1] || 'N/A',
          version: version || title.split(' ').slice(2).join(' ') || '',
          year: parseYear(year || title),
          mileage: parseMileage(mileage),
          fuel: fuel || 'Flex',
          color: color || 'N/A',
          price: parsePrice(priceText),
          detailUrl,
          imageUrl: imageUrl || undefined,
          category: detectCategory(model || title),
        };
        
        // Só adiciona se tiver dados mínimos
        if (vehicle.brand !== 'N/A' && vehicle.model !== 'N/A') {
          vehicles.push(vehicle);
        }
      } catch (error) {
        console.error('Erro ao processar veículo:', error);
      }
    });
    
    console.log(`✅ Página ${pageNumber}: ${vehicles.length} veículos encontrados`);
    return vehicles;
    
  } catch (error: any) {
    console.error(`❌ Erro ao scraping página ${pageNumber}:`, error.message);
    return [];
  }
}

async function scrapeAllPages(config: ScraperConfig): Promise<VehicleData[]> {
  console.log(`\n🚀 Iniciando scraping: ${config.clientName}`);
  console.log(`📍 URL: ${config.inventoryUrl}\n`);
  
  const allVehicles: VehicleData[] = [];
  
  for (let page = 1; page <= config.maxPages; page++) {
    const vehicles = await scrapePage(config, page);
    
    if (vehicles.length === 0 && page > 1) {
      console.log(`⏹️  Página ${page} vazia, encerrando...`);
      break;
    }
    
    allVehicles.push(...vehicles);
    
    // Delay entre páginas para não sobrecarregar o servidor
    if (page < config.maxPages) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  console.log(`\n✅ Scraping concluído! Total: ${allVehicles.length} veículos\n`);
  
  // Estatísticas
  const categoryCounts = allVehicles.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📊 Distribuição por categoria:');
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
  
  const withPrice = allVehicles.filter(v => v.price !== null).length;
  console.log(`\n💰 Veículos com preço: ${withPrice}/${allVehicles.length}`);
  
  return allVehicles;
}

async function main() {
  const args = process.argv.slice(2);
  let configPath: string;
  
  // Verifica argumentos
  const configIndex = args.indexOf('--config');
  if (configIndex !== -1 && args[configIndex + 1]) {
    configPath = args[configIndex + 1];
  } else {
    console.log('❌ Uso: npx tsx scripts/generic-scraper.ts --config scripts/clients/[cliente].config.json');
    console.log('\n📁 Crie um arquivo de configuração baseado no template:');
    console.log('   scripts/clients/template.config.json');
    process.exit(1);
  }
  
  // Carrega configuração
  const fullPath = join(process.cwd(), configPath);
  if (!existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }
  
  const config: ScraperConfig = JSON.parse(readFileSync(fullPath, 'utf-8'));
  
  // Executa scraping
  const vehicles = await scrapeAllPages(config);
  
  // Salva resultado
  const outputPath = join(process.cwd(), 'scripts', 'clients', `${config.clientId}-vehicles.json`);
  writeFileSync(outputPath, JSON.stringify(vehicles, null, 2), 'utf-8');
  
  console.log(`\n💾 Dados salvos em: ${outputPath}`);
  
  if (vehicles.length > 0) {
    console.log('\n📋 Exemplo de veículo:');
    console.log(JSON.stringify(vehicles[0], null, 2));
  }
  
  console.log('\n🎯 Próximo passo: Execute o seed para popular o banco de dados');
  console.log(`   npm run db:seed:client -- --client ${config.clientId}`);
}

main().catch(console.error);
