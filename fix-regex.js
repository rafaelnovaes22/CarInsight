const fs = require('fs');
let content = fs.readFileSync('src/services/guardrails.service.ts', 'utf8');

// Procurar o padrão quebrado
const lines = content.split('\n');

// Verificar se as linhas 347 e 348 são as problemáticas
const line347 = lines[346].replace(/\r$/, '');
const line348 = lines[347].replace(/\r$/, '');

// A linha 347 deve ter: if (/(.)) - 12 caracteres
// A linha 348 deve ter: {10,}/.test(message)) { - resto da regex
if (line347 === '    if (/(.))' && line348 === '{10,}/.test(message)) {') {
  console.log('Found broken pattern at lines 347-348');

  // Juntar as linhas adicionando 'n' (literal) entre elas
  // if (/(.)) + n + {10,}/.test(message)) {
  const correctLine = '    if (/(.))' + 'n{10,}/.test(message)) {';

  lines[346] = correctLine;
  lines[347] = '';

  fs.writeFileSync('src/services/guardrails.service.ts', lines.join('\n'));
  console.log('Fixed!');
} else {
  console.log('Pattern not found.');
  console.log('Line 347:', JSON.stringify(line347), 'Length:', line347.length);
  console.log('Expected: ', JSON.stringify('    if (/(.))'), 'Length:', '    if (/(.))'.length);
  console.log('Line 348:', JSON.stringify(line348));
}
