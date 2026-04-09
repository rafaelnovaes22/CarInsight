/**
 * Diagnóstico: mostra o HTML bruto da página de detalhes de um veículo
 * Uso: node tools/scripts/scraping/debug-detail-page.mjs 679
 */

import https from 'https';

const id = process.argv[2] || '679';
const BASE_URL = 'https://ssl9212.websiteseguro.com';
const DETAIL_PATH = '/armazena1/atw_site/site/atw6944b/Detalhes.aspx';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      timeout: 15000,
    };

    https
      .get(url, options, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirect = res.headers.location;
          const full = redirect.startsWith('http') ? redirect : BASE_URL + redirect;
          return fetchPage(full).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, html: data }));
      })
      .on('error', reject);
  });
}

// Tentar página de detalhes do site principal
const siteUrl = `https://www.renatinhuscars.com.br/?id=${id}`;
console.log(`\n--- Tentando site principal: ${siteUrl} ---\n`);
const siteResult = await fetchPage(siteUrl);
console.log(`Status: ${siteResult.status} | Tamanho: ${siteResult.html.length} chars`);

const keywords = [
  'quilometragem',
  'km',
  'valor',
  'r$',
  'preço',
  'preco',
  'cor',
  'câmbio',
  'cambio',
  'combustivel',
  'combustível',
  'ano',
];
const siteLines = siteResult.html.split('\n');
console.log('\n=== Linhas com dados relevantes (site principal) ===\n');
siteLines.forEach((line, i) => {
  const lower = line.toLowerCase();
  if (keywords.some(k => lower.includes(k)) && line.trim().length > 5) {
    console.log(`[${i}] ${line.trim().substring(0, 300)}`);
  }
});

// Tentar estoque e verificar bloco do id específico
const stockUrl = `https://ssl9212.websiteseguro.com/armazena1/atw_site/site/atw6944b/Estoque.aspx?nu=-1`;
console.log(`\n--- Checando bloco do id=${id} na página de estoque ---\n`);
const stockResult = await fetchPage(stockUrl);
const html = stockResult.html;
const detIndex = html.indexOf(`Det(${id},`);
if (detIndex !== -1) {
  const block = html.substring(Math.max(0, detIndex - 1000), detIndex + 2000);
  console.log(block.substring(0, 3000));
} else {
  console.log(`ID ${id} não encontrado na página de estoque`);
}
