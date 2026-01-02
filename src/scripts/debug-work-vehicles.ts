import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listVehicles() {
  const vehicles = await prisma.vehicle.findMany({
    where: { disponivel: true },
    select: { id: true, marca: true, modelo: true, carroceria: true, descricao: true },
  });

  console.log(`Total Vehicles: ${vehicles.length}`);
  console.log('--- Pickups / Possible Work Vehicles ---');

  const workCandidates = vehicles.filter(
    v =>
      v.carroceria?.toLowerCase().includes('picape') ||
      v.carroceria?.toLowerCase().includes('pickup') ||
      v.modelo.toLowerCase().includes('strada') ||
      v.modelo.toLowerCase().includes('saveiro') ||
      v.modelo.toLowerCase().includes('toro') ||
      v.modelo.toLowerCase().includes('hilux') ||
      v.modelo.toLowerCase().includes('montana')
  );

  workCandidates.forEach(v => {
    console.log(
      `[${v.marca} ${v.modelo}] Body: ${v.carroceria} | Desc: ${v.descricao?.substring(0, 50)}...`
    );
  });

  console.log('--- End ---');
}

listVehicles();
