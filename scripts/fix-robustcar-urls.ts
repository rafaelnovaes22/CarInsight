import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RobustCarVehicle {
  brand: string;
  model: string;
  version: string;
  year: number;
  mileage: number;
  fuel: string;
  color: string;
  price: number | null;
  detailUrl: string;
  category: string;
}

function fixUrl(url: string): string {
  // Corrigir caracteres mal codificados
  let fixed = url
    .replace(/S�o/g, 'Sao')
    .replace(/H�BRIDO/gi, 'Hibrido')
    .replace(/�/g, 'a')
    .replace(/�/g, 'e')
    .replace(/�/g, 'i')
    .replace(/�/g, 'o')
    .replace(/�/g, 'u')
    .replace(/�/g, 'a')
    .replace(/�/g, 'e')
    .replace(/�/g, 'o')
    .replace(/�/g, 'c');

  // Remover espaços extras e normalizar
  fixed = fixed.replace(/\s+/g, '-');
  
  // Garantir que está no formato correto
  if (!fixed.startsWith('http')) {
    fixed = `https://robustcar.com.br${fixed.startsWith('/') ? '' : '/'}${fixed}`;
  }

  return fixed;
}

async function main() {
  console.log('🔧 Corrigindo URLs do arquivo robustcar-vehicles.json...\n');

  const jsonPath = join(process.cwd(), 'scripts', 'robustcar-vehicles.json');
  
  try {
    const data = readFileSync(jsonPath, 'utf-8');
    const vehicles: RobustCarVehicle[] = JSON.parse(data);

    console.log(`📦 Carregados ${vehicles.length} veículos\n`);

    let fixedCount = 0;

    const fixedVehicles = vehicles.map((vehicle) => {
      const originalUrl = vehicle.detailUrl;
      const fixedUrl = fixUrl(originalUrl);

      if (originalUrl !== fixedUrl) {
        fixedCount++;
        console.log(`✅ ${vehicle.brand} ${vehicle.model} ${vehicle.year}`);
        console.log(`   Antes: ${originalUrl}`);
        console.log(`   Depois: ${fixedUrl}\n`);
      }

      return {
        ...vehicle,
        detailUrl: fixedUrl
      };
    });

    // Criar backup do arquivo original
    const backupPath = join(process.cwd(), 'scripts', 'robustcar-vehicles.backup.json');
    writeFileSync(backupPath, data, 'utf-8');
    console.log(`💾 Backup criado: ${backupPath}\n`);

    // Salvar arquivo corrigido
    writeFileSync(jsonPath, JSON.stringify(fixedVehicles, null, 2), 'utf-8');

    console.log('\n📊 Resumo:');
    console.log(`   ✅ URLs corrigidas: ${fixedCount}`);
    console.log(`   📦 Total de veículos: ${vehicles.length}`);
    console.log(`   💾 Backup salvo em: robustcar-vehicles.backup.json`);
    console.log('\n✅ Correção concluída com sucesso!');
    console.log('\n💡 Próximo passo: Execute "npm run db:seed:robustcar" para popular o banco com URLs corretas');

  } catch (error) {
    console.error('❌ Erro ao processar arquivo:', error);
    process.exit(1);
  }
}

main();
