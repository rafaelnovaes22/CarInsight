import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fixUrl(url: string | null): string | null {
  if (!url) return null;

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
  console.log('🔧 Atualizando URLs dos veículos no banco de dados...\n');

  const vehicles = await prisma.vehicle.findMany({
    select: {
      id: true,
      marca: true,
      modelo: true,
      ano: true,
      url: true,
      fotoUrl: true,
      fotosUrls: true
    }
  });

  console.log(`📦 Encontrados ${vehicles.length} veículos no banco\n`);

  let updatedCount = 0;

  for (const vehicle of vehicles) {
    const originalUrl = vehicle.url;
    const fixedUrl = fixUrl(originalUrl);

    if (originalUrl !== fixedUrl) {
      try {
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            url: fixedUrl,
            fotoUrl: fixedUrl,
            fotosUrls: fixedUrl ? JSON.stringify([fixedUrl]) : vehicle.fotosUrls
          }
        });

        updatedCount++;
        console.log(`✅ ${updatedCount}. ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`);
        console.log(`   Antes: ${originalUrl}`);
        console.log(`   Depois: ${fixedUrl}\n`);
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${vehicle.marca} ${vehicle.modelo}:`, error);
      }
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   ✅ URLs atualizadas: ${updatedCount}`);
  console.log(`   📦 Total de veículos: ${vehicles.length}`);
  console.log('\n✅ Atualização concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro na atualização:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
