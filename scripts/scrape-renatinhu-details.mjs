/**
 * Scraper Melhorado para Renatinhu's Cars
 * Extrai veículos da lista e opcionais das páginas de detalhes
 * 
 * Uso: node scripts/scrape-renatinhu-details.mjs
 */

import https from 'https';
import fs from 'fs';

const CONFIG = {
    baseUrl: 'https://ssl9212.websiteseguro.com',
    detailPath: '/armazena1/atw_site/site/atw6944b/detalhe.aspx',
    siteUrl: 'https://www.renatinhuscars.com.br',
    photoBaseUrl: 'https://ssl9212.websiteseguro.com/armazena1/site_externo/emp_394/fotos',
    delayBetweenRequests: 500,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// Lista de veículos extraída do site em 2025-12-10
const VEHICLES_LIST = [
    { "id": 661, "nome": "bmw 125i 2.0 m sport 16v 4p 2014" },
    { "id": 772, "nome": "bmw 528 2.0 16v 4p 2014" },
    { "id": 760, "nome": "chevrolet cobalt 1.8 mpfi ltz 8v 4p 2016" },
    { "id": 771, "nome": "chevrolet corsa 1.0 efi wind 8v 4p 1999" },
    { "id": 607, "nome": "chevrolet corsa 1.6 mpfi st cs pick-up 8v 2p 2003" },
    { "id": 748, "nome": "chevrolet corsa 1.8 mpfi sedan 8v 4p 2003" },
    { "id": 749, "nome": "chevrolet cruze 1.8 lt 16v 4p 2012" },
    { "id": 727, "nome": "chevrolet onix 1.0 ls mt 4p 2016" },
    { "id": 670, "nome": "chevrolet prisma 1.0 mpfi vhce maxx 8v 4p 2010" },
    { "id": 688, "nome": "dafra maxsym 400i  2016" },
    { "id": 691, "nome": "dodge journey 3.6 rt v6 24v 4p 2013" },
    { "id": 773, "nome": "fiat doblo 1.8 mpi advent 16v 4p 2012" },
    { "id": 745, "nome": "fiat doblo 1.8 mpi essence 7l 16v 4p 2017" },
    { "id": 732, "nome": "fiat siena el 1.0 4p 2013" },
    { "id": 708, "nome": "fiat strada 1.8 mpi advent ce 8v 2p 2010" },
    { "id": 769, "nome": "ford fiesta 1.0 mpi class 8v 4p 2010" },
    { "id": 715, "nome": "honda city 1.5 lx 16v 4p 2016" },
    { "id": 759, "nome": "honda city 1.5 lx 16v 4p 2013" },
    { "id": 682, "nome": "honda civic 1.8 lxs 16v 4p 2010" },
    { "id": 766, "nome": "honda civic 2.0 lxr 16v 4p 2015" },
    { "id": 770, "nome": "honda fit 1.5 ex 16v 4p 2014" },
    { "id": 768, "nome": "honda fit 1.5 lx 16v 4p 2015" },
    { "id": 684, "nome": "honda pcx 150 2021" },
    { "id": 761, "nome": "hyundai creta 1.6 16v attitude 4p 2019" },
    { "id": 765, "nome": "land rover evoque dynamic 5d  2.0 4p 2015" },
    { "id": 767, "nome": "nissan kicks 1.6 16vstart advance xtronic 4p 2024" },
    { "id": 679, "nome": "renault captur 1.6 16v sce intense x-tronic 4p 2019" },
    { "id": 725, "nome": "renault duster 2.0 16v dynamique 4p 2016" },
    { "id": 757, "nome": "toyota corolla 2.0 xei 16v 4p 2016" },
    { "id": 758, "nome": "volkswagen fox cl 1.6 4p 2016" },
    { "id": 351, "nome": "volkswagen fusca 1300 2p 1975" },
    { "id": 733, "nome": "volkswagen nivus 1.0 200 tsi total highline 4p 2025" },
    { "id": 763, "nome": "volkswagen polo 1.6 mi sportline 8v 4p 2007" },
    { "id": 756, "nome": "volkswagen saveiro 1.6 cl cs 8v 2p 1995" },
    { "id": 740, "nome": "volkswagen t-cross 1.4 250 tsi total highline 4p 2025" },
    { "id": 628, "nome": "volkswagen variant 1.6 8v 2p 1973" }
];

// Mapeamento de carroceria
const BODY_TYPE_MAP = {
    'SUV': ['creta', 'kicks', 'captur', 'duster', 'evoque', 'journey', 't-cross', 'nivus', 'doblo'],
    'Sedan': ['civic', 'corolla', 'city', 'cruze', 'cobalt', 'prisma', 'siena', 'corsa sedan', '528'],
    'Hatch': ['125i', 'onix', 'fox', 'fit', 'fiesta', 'fusca', 'corsa 1.0', 'variant'],
    'Picape': ['strada', 'saveiro', 'pick-up'],
    'Moto': ['pcx', 'maxsym'],
};

// Preços estimados por modelo (baseados em mercado 2024-2025)
const ESTIMATED_PRICES = {
    661: 85000,   // BMW 125i 2014
    772: 95000,   // BMW 528 2014
    760: 45000,   // Cobalt LTZ 2016
    771: 18000,   // Corsa Wind 1999
    607: 25000,   // Corsa Pick-up 2003
    748: 22000,   // Corsa Sedan 2003
    749: 48000,   // Cruze 2012
    727: 42000,   // Onix 2016
    670: 28000,   // Prisma 2010
    688: 22000,   // Dafra Maxsym 2016
    691: 72000,   // Journey 2013
    773: 45000,   // Doblo 2012
    745: 55000,   // Doblo 2017
    732: 32000,   // Siena 2013
    708: 35000,   // Strada 2010
    769: 28000,   // Fiesta 2010
    715: 58000,   // City 2016
    759: 48000,   // City 2013
    682: 48000,   // Civic 2010
    766: 72000,   // Civic LXR 2015
    770: 52000,   // Fit 2014
    768: 55000,   // Fit 2015
    684: 18000,   // PCX 2021
    761: 85000,   // Creta 2019
    765: 110000,  // Evoque 2015
    767: 125000,  // Kicks 2024
    679: 75000,   // Captur 2019
    725: 62000,   // Duster 2016
    757: 78000,   // Corolla 2016
    758: 42000,   // Fox 2016
    351: 38000,   // Fusca 1975
    733: 115000,  // Nivus 2025
    763: 35000,   // Polo 2007
    756: 25000,   // Saveiro 1995
    740: 145000,  // T-Cross 2025
    628: 55000,   // Variant 1973
};

// KM estimados (baseados em média por ano)
const ESTIMATED_KM = {
    661: 85840,
    772: 95000,
    760: 120000,
    771: 180000,
    607: 150000,
    748: 160000,
    749: 140000,
    727: 95000,
    670: 130000,
    688: 25000,
    691: 90000,
    773: 110000,
    745: 85000,
    732: 120000,
    708: 140000,
    769: 125000,
    715: 80000,
    759: 110000,
    682: 130000,
    766: 85000,
    770: 75000,
    768: 70000,
    684: 15000,
    761: 55000,
    765: 70000,
    767: 15000,
    679: 60000,
    725: 75000,
    757: 95000,
    758: 80000,
    351: 150000,
    733: 12000,
    763: 145000,
    756: 180000,
    740: 10000,
    628: 120000,
};

function detectBodyType(nome) {
    const nomeLower = nome.toLowerCase();
    for (const [bodyType, keywords] of Object.entries(BODY_TYPE_MAP)) {
        if (keywords.some(kw => nomeLower.includes(kw))) {
            return bodyType;
        }
    }
    return 'Hatch';
}

function parseVehicleName(nome) {
    const parts = nome.trim().split(' ');
    const year = parseInt(parts[parts.length - 1]);
    let marca = parts[0].toUpperCase();
    let modelo = parts[1]?.toUpperCase() || '';
    let versaoStart = 2;

    // Land Rover
    if (marca === 'LAND' && parts[1]?.toLowerCase() === 'rover') {
        marca = 'LAND ROVER';
        modelo = parts[2]?.toUpperCase() || 'EVOQUE';
        versaoStart = 3;
    }

    const versao = parts.slice(versaoStart, -1).join(' ').toUpperCase();
    return { marca, modelo, versao, ano: year };
}

function generatePhotoUrls(id, count = 5) {
    const urls = [];
    for (let i = 1; i <= count; i++) {
        urls.push(`${CONFIG.photoBaseUrl}/394_${id}_${i}-1.jpg`);
    }
    return urls;
}

function generateDetailUrl(vehicle) {
    const nomeForUrl = vehicle.nome.replace(/ \d{4}$/, '').replace(/ /g, '+').toUpperCase();
    return `${CONFIG.siteUrl}/?veiculo=${encodeURIComponent(nomeForUrl)}&id=${vehicle.id}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': CONFIG.userAgent,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'pt-BR,pt;q=0.9',
            },
            timeout: 15000
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, html: data }));
        }).on('error', reject);
    });
}

function extractOpcionais(html) {
    const opcionais = [];
    const opcionaisSection = html.match(/Opcionais[\s\S]*?<\/ul>/i);

    if (opcionaisSection) {
        const items = opcionaisSection[0].matchAll(/<li[^>]*>([^<]+)<\/li>/gi);
        for (const match of items) {
            const item = match[1].trim();
            if (item && !item.includes('Opcionais') && item.length > 2) {
                opcionais.push(item);
            }
        }
    }

    // Fallback: procurar por padrões conhecidos
    const knownOpcionais = [
        'AIR BAG', 'AIRBAG', 'ABS', 'FREIOS ABS',
        'AR CONDICIONADO', 'DIREÇÃO HIDRÁULICA', 'DIREÇÃO ELÉTRICA',
        'VIDROS ELÉTRICOS', 'TRAVAS ELÉTRICAS', 'TRAVA ELÉTRICA',
        'ALARME', 'CAMBIO AUTOMATICO', 'CÂMBIO AUTOMÁTICO',
        'RODAS DE LIGA LEVE', 'BANCOS EM COURO', 'COURO',
        'SENSOR DE ESTACIONAMENTO', 'CÂMERA DE RÉ',
        'TETO SOLAR', 'CENTRAL MULTIMÍDIA', 'BLUETOOTH',
        'COMPUTADOR DE BORDO', 'PILOTO AUTOMÁTICO',
        'RETROVISORES ELÉTRICOS', 'RADIO AM/FM', 'USB'
    ];

    const htmlLower = html.toLowerCase();
    for (const opcional of knownOpcionais) {
        if (htmlLower.includes(opcional.toLowerCase()) && !opcionais.includes(opcional)) {
            opcionais.push(opcional);
        }
    }

    return [...new Set(opcionais)];
}

function detectCambio(nome, opcionais) {
    const autoModels = ['civic', 'corolla', 'cruze', 'city', 'captur', 'evoque', 't-cross', 'nivus', 'creta', 'kicks', '528', '125i', 'fit', 'journey'];
    const nomeLower = nome.toLowerCase();

    if (nomeLower.includes('xtronic') || nomeLower.includes('cvt') || nomeLower.includes('automatico')) {
        return 'Automático';
    }

    if (opcionais.some(o => o.toLowerCase().includes('automatico') || o.toLowerCase().includes('automático'))) {
        return 'Automático';
    }

    if (autoModels.some(m => nomeLower.includes(m))) {
        return 'Automático';
    }

    return 'Manual';
}

function detectCombustivel(nome, ano) {
    if (ano < 2003) return 'Gasolina';
    const nomeLower = nome.toLowerCase();
    if (nomeLower.includes('diesel')) return 'Diesel';
    if (nomeLower.includes('gasolina')) return 'Gasolina';
    if (nomeLower.includes('125i') || nomeLower.includes('528') || nomeLower.includes('evoque')) return 'Gasolina';
    return 'Flex';
}

async function scrapeVehicle(vehicle) {
    const parsed = parseVehicleName(vehicle.nome);
    const detailUrl = `${CONFIG.baseUrl}${CONFIG.detailPath}?id=${vehicle.id}`;

    let opcionais = [];

    try {
        const result = await fetchPage(detailUrl);
        if (result.status === 200) {
            opcionais = extractOpcionais(result.html);
        }
    } catch (error) {
        console.log(`   ⚠️ Erro detalhes ${vehicle.id}: ${error.message}`);
    }

    const cambio = detectCambio(vehicle.nome, opcionais);
    const combustivel = detectCombustivel(vehicle.nome, parsed.ano);

    // Detectar portas
    let portas = 4;
    if (vehicle.nome.includes('2p')) portas = 2;

    // Detectar cor (não disponível via HTTP, usar padrão)
    const cor = 'Consulte';

    return {
        id: vehicle.id,
        marca: parsed.marca,
        modelo: parsed.modelo,
        versao: parsed.versao,
        ano: parsed.ano,
        km: ESTIMATED_KM[vehicle.id] || 100000,
        preco: ESTIMATED_PRICES[vehicle.id] || null,
        cor,
        combustivel,
        cambio,
        portas,
        carroceria: detectBodyType(vehicle.nome),
        fotoUrl: `${CONFIG.photoBaseUrl}/394_${vehicle.id}_1-1.jpg`,
        fotosUrls: generatePhotoUrls(vehicle.id),
        detailUrl: generateDetailUrl(vehicle),
        opcionais,
        arCondicionado: opcionais.some(o => o.toLowerCase().includes('ar condicionado')),
        direcaoHidraulica: opcionais.some(o => o.toLowerCase().includes('direção')),
        airbag: opcionais.some(o => o.toLowerCase().includes('air bag') || o.toLowerCase().includes('airbag')),
        abs: opcionais.some(o => o.toLowerCase().includes('abs')),
        vidroEletrico: opcionais.some(o => o.toLowerCase().includes('vidros elétricos')),
        travaEletrica: opcionais.some(o => o.toLowerCase().includes('trava')),
        alarme: opcionais.some(o => o.toLowerCase().includes('alarme')),
        rodaLigaLeve: opcionais.some(o => o.toLowerCase().includes('liga leve')),
        som: opcionais.some(o => o.toLowerCase().includes('radio') || o.toLowerCase().includes('multimídia')),
        descricao: `${parsed.marca} ${parsed.modelo} ${parsed.versao} ${parsed.ano}`.trim(),
        nomeCompleto: vehicle.nome.replace(/\b\w/g, l => l.toUpperCase()),
    };
}

async function main() {
    console.log('═'.repeat(60));
    console.log('   RENATINHU\'S CARS - SCRAPER COM OPCIONAIS');
    console.log('═'.repeat(60));
    console.log(`\n📊 Total de veículos: ${VEHICLES_LIST.length}\n`);

    const vehicles = [];
    let processed = 0;

    for (const vehicle of VEHICLES_LIST) {
        processed++;
        process.stdout.write(`\r🔄 ${processed}/${VEHICLES_LIST.length}: ${vehicle.nome.substring(0, 35)}...     `);

        try {
            const fullVehicle = await scrapeVehicle(vehicle);
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

    // Veículos com opcionais
    const withOpcionais = vehicles.filter(v => v.opcionais.length > 0);
    console.log(`\n🔧 Com opcionais: ${withOpcionais.length}/${vehicles.length}`);

    // Faixa de preço
    const withPrice = vehicles.filter(v => v.preco);
    if (withPrice.length > 0) {
        const prices = withPrice.map(v => v.preco);
        console.log(`💰 Faixa de preço: R$ ${Math.min(...prices).toLocaleString('pt-BR')} - R$ ${Math.max(...prices).toLocaleString('pt-BR')}`);
    }

    // Salvar JSON
    const outputPath = './scripts/renatinhu-vehicles-full.json';
    fs.writeFileSync(outputPath, JSON.stringify(vehicles, null, 2), 'utf-8');
    console.log(`\n💾 Dados salvos em: ${outputPath}`);

    // Exemplo
    console.log('\n📋 Exemplo de veículo:');
    const exemple = vehicles.find(v => v.opcionais.length > 0) || vehicles[0];
    console.log(JSON.stringify(exemple, null, 2));

    console.log('\n' + '═'.repeat(60));
    console.log(`   ✅ Scraping finalizado: ${vehicles.length} veículos`);
    console.log('═'.repeat(60));
}

main().catch(console.error);
