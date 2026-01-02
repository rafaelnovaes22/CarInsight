import { prisma } from '../lib/prisma';
import { inMemoryVectorStore } from '../services/in-memory-vector.service';
import * as fs from 'fs';

// Helper to reconstruct the logic from InMemoryVectorStore (since it's private)
function buildVehicleDescription(vehicle: any): string {
  const parts = [
    `${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}`,
    `ano ${vehicle.ano}`,
    `${vehicle.km.toLocaleString('pt-BR')}km`,
    `${vehicle.combustivel}`,
    `${vehicle.cambio}`,
    `cor ${vehicle.cor}`,
  ];

  const features: string[] = [];
  if (vehicle.arCondicionado) features.push('ar condicionado');
  if (vehicle.direcaoHidraulica) features.push('direção hidráulica');
  if (vehicle.airbag) features.push('airbag');
  if (vehicle.abs) features.push('abs');
  if (vehicle.vidroEletrico) features.push('vidro elétrico');
  if (vehicle.travaEletrica) features.push('trava elétrica');

  if (features.length > 0) {
    parts.push(`equipamentos: ${features.join(', ')}`);
  }

  if (vehicle.descricao) {
    parts.push(vehicle.descricao);
  }

  if (vehicle.preco) {
    parts.push(`preço R$ ${vehicle.preco.toLocaleString('pt-BR')}`);
  }

  return parts.join('. ');
}

async function inspectData() {
  const targets = ['HB20 2025', 'Tucson 2013', 'Idea 2014'];

  let output = '📊 ANALISANDO DADOS DE INPUT PARA EMBEDDINGS...\n\n';

  for (const target of targets) {
    const [model, year] = target.split(' ');

    // Find closest match
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        modelo: { contains: model, mode: 'insensitive' },
        ano: parseInt(year),
      },
    });

    if (!vehicle) {
      output += `❌ Veículo não encontrado: ${target}\n`;
      continue;
    }

    const description = buildVehicleDescription(vehicle);

    output += `🚗 VEÍCULO: ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}\n`;
    output += `--------------------------------------------------\n`;
    output += `📝 BODY TYPE (Banco): ${vehicle.carroceria}\n`;
    output += `📝 DESCRIÇÃO ORIGINAL (Banco): ${vehicle.descricao || '[VAZIO]'}\n`;
    output += `🔤 STRING GERADA PARA A IA (O que vira embedding):\n`;
    output += `"${description}"\n`;
    output += `--------------------------------------------------\n\n`;
  }

  fs.writeFileSync('embedding_inputs.txt', output, 'utf-8');
  console.log('✅ Resultado salvo em embedding_inputs.txt');
  process.exit(0);
}

inspectData();
