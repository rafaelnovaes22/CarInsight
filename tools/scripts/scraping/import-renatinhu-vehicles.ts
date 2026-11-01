/**
 * Script para importar veículos do scraping para o banco de dados
 * Remove preços estimados - serão adicionados posteriormente
 *
 * Uso: npx tsx scripts/import-renatinhu-vehicles.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ScrapedVehicle {
  id: number;
  marca: string;
  modelo: string;
  versao: string;
  ano: number;
  km: number;
  preco: number | null;
  cor: string;
  combustivel: string;
  cambio: string;
  portas: number;
  carroceria: string;
  fotoUrl: string;
  fotosUrls: string[];
  detailUrl: string;
  opcionais: string[];
  arCondicionado: boolean;
  direcaoHidraulica: boolean;
  airbag: boolean;
  abs: boolean;
  vidroEletrico: boolean;
  travaEletrica: boolean;
  alarme: boolean;
  rodaLigaLeve: boolean;
  som: boolean;
  descricao: string;
  nomeCompleto: string;
}

async function importVehicles() {
  console.log('═'.repeat(60));
  console.log('   IMPORTANDO VEÍCULOS PARA O BANCO DE DADOS');
  console.log('═'.repeat(60));

  // Carregar JSON
  const jsonPath = path.join(__dirname, 'renatinhu-vehicles-full.json');
  const jsonData = fs.readFileSync(jsonPath, 'utf-8');
  const vehicles: ScrapedVehicle[] = JSON.parse(jsonData);

  console.log(`\n📊 Total de veículos no JSON: ${vehicles.length}`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const v of vehicles) {
    try {
      // Buscar veículo existente pelo ID externo ou marca/modelo/ano
      const existing = await prisma.vehicle.findFirst({
        where: {
          OR: [
            { externalId: v.id.toString() },
            {
              AND: [{ marca: v.marca }, { modelo: v.modelo }, { ano: v.ano }],
            },
          ],
        },
      });

      const vehicleData = {
        marca: v.marca,
        modelo: v.modelo,
        versao: v.versao,
        ano: v.ano,
        km: v.km,
        preco: null, // Sem preço estimado - será adicionado depois
        cor: v.cor === 'Consulte' ? null : v.cor,
        combustivel: v.combustivel,
        cambio: v.cambio,
        portas: v.portas,
        carroceria: v.carroceria,
        fotoUrl: v.fotoUrl,
        fotosUrls: JSON.stringify(v.fotosUrls),
        detailUrl: v.detailUrl,
        opcionais: JSON.stringify(v.opcionais),
        arCondicionado: v.arCondicionado,
        direcaoHidraulica: v.direcaoHidraulica,
        airbag: v.airbag,
        abs: v.abs,
        vidroEletrico: v.vidroEletrico,
        travaEletrica: v.travaEletrica,
        alarme: v.alarme,
        rodaLigaLeve: v.rodaLigaLeve,
        som: v.som,
        descricao: v.descricao || `${v.marca} ${v.modelo} ${v.versao} ${v.ano}`,
        externalId: v.id.toString(),
        disponivel: true,
      };

      if (existing) {
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: vehicleData,
        });
        updated++;
        console.log(`✏️  Atualizado: ${v.marca} ${v.modelo} ${v.ano}`);
      } else {
        await prisma.vehicle.create({
          data: vehicleData,
        });
        created++;
        console.log(`✅ Criado: ${v.marca} ${v.modelo} ${v.ano}`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Erro em ${v.marca} ${v.modelo}: ${error}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('   RESUMO DA IMPORTAÇÃO');
  console.log('═'.repeat(60));
  console.log(`✅ Criados: ${created}`);
  console.log(`✏️  Atualizados: ${updated}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`📊 Total processado: ${created + updated + errors}`);
  console.log('═'.repeat(60));
}

async function main() {
  try {
    await importVehicles();
  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
