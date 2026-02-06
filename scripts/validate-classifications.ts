import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to normalize strings
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function main() {
  console.log('Starting Classification Validation...');

  const vehicles = await prisma.vehicle.findMany({
    where: { disponivel: true },
  });

  console.log(`Analyzing ${vehicles.length} available vehicles...`);

  const report = {
    total: vehicles.length,
    aptoCarga: { mismatches: [] as string[] },
    aptoEntrega: { mismatches: [] as string[] },
    aptoUber: { mismatches: [] as string[] },
    aptoUberBlack: { mismatches: [] as string[] },
    aptoFamilia: { mismatches: [] as string[] },
    aptoUsoDiario: { mismatches: [] as string[] },
  };

  const lists = {
    aptoCarga: [] as string[],
    aptoUberBlack: [] as string[],
  };

  for (const v of vehicles) {
    const body = normalize(v.carroceria);
    const model = normalize(v.modelo);
    const brand = normalize(v.marca);
    const name = `${v.marca} ${v.modelo} (${v.ano}) - ${v.carroceria}`;

    if (v.aptoCarga) lists.aptoCarga.push(name);
    if (v.aptoUberBlack) lists.aptoUberBlack.push(name);

    // --- aptoCarga Rules ---
    // Expected: Pickups, Vans, Furgões
    const isCargoBody = ['pickup', 'picape', 'furg', 'van', 'caminhonete'].some(t =>
      body.includes(t)
    );
    if (v.aptoCarga && !isCargoBody) {
      report.aptoCarga.mismatches.push(
        `[FALSE POSITIVE] ${name}: Marked aptoCarga but body is '${v.carroceria}'`
      );
    }

    // --- aptoEntrega Rules ---
    // Expected: >= 2010, functional
    if (v.aptoEntrega) {
      if (v.ano < 2010)
        report.aptoEntrega.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoEntrega but year ${v.ano} < 2010`
        );
      // if (v.portas < 2) report.aptoEntrega.mismatches.push(`[FALSE POSITIVE] ${name}: Marked aptoEntrega but has ${v.portas} doors`);
    }

    // --- aptoUber Rules ---
    // Expected: >= 2012, 4 doors, AC
    if (v.aptoUber) {
      if (v.ano < 2012)
        report.aptoUber.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoUber but year ${v.ano} < 2012`
        );
      if (v.portas < 4)
        report.aptoUber.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoUber but has ${v.portas} doors`
        );
      if (!v.arCondicionado)
        report.aptoUber.mismatches.push(`[FALSE POSITIVE] ${name}: Marked aptoUber but no AC`);
    }

    // --- aptoUberBlack Rules ---
    // Expected: >= 2018 (sedan) or >= 2019 (suv), 4 doors, AC. Hatchbacks excluded.
    if (v.aptoUberBlack) {
      if (v.ano < 2018)
        report.aptoUberBlack.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoUberBlack but year ${v.ano} too old`
        );
      if (body.includes('hatch'))
        report.aptoUberBlack.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoUberBlack but is HATCH`
        );
      if (v.portas < 4)
        report.aptoUberBlack.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoUberBlack but has ${v.portas} doors`
        );
    }

    // --- aptoFamilia Rules ---
    // Expected: 4 doors, Space (Sedan, SUV, Minivan, Perua) or large hatch?
    // Current Strict Rule: Exclude small hatches
    const isFamilyBody = ['sed', 'suv', 'minivan', 'van', 'perua', 'wagon'].some(t =>
      body.includes(t)
    );
    // Small hatches check (Mobi, Kwid, Up) - usually not family
    const isSmallHatch = ['mobi', 'kwid', 'up', 'picanto', 'celta', 'gol', 'uno', 'ka'].some(m =>
      model.includes(m)
    );

    if (v.aptoFamilia) {
      if (v.portas < 4)
        report.aptoFamilia.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoFamilia but has ${v.portas} doors`
        );
      if (!isFamilyBody && isSmallHatch)
        report.aptoFamilia.mismatches.push(
          `[QUESTIONABLE] ${name}: Marked aptoFamilia but is small hatch '${v.modelo}'`
        );
    }

    // --- aptoUsoDiario Rules ---
    // Expected: Economical, AC
    if (v.aptoUsoDiario) {
      if (!v.arCondicionado)
        report.aptoUsoDiario.mismatches.push(
          `[FALSE POSITIVE] ${name}: Marked aptoUsoDiario but no AC`
        );
      // Checking for "beberroes"
      if (
        body.includes('camaro') ||
        body.includes('mustang') ||
        (body.includes('pickup') && !model.includes('strada') && !model.includes('saveiro'))
      ) {
        report.aptoUsoDiario.mismatches.push(
          `[QUESTIONABLE] ${name}: Marked aptoUsoDiario but might be guzzler`
        );
      }
    }
  }

  // Printing Report
  console.log('\n--- VALIDATION REPORT ---\n');

  // Calculate stats
  const stats = {
    aptoCarga: vehicles.filter(v => v.aptoCarga).length,
    aptoEntrega: vehicles.filter(v => v.aptoEntrega).length,
    aptoUber: vehicles.filter(v => v.aptoUber).length,
    aptoUberBlack: vehicles.filter(v => v.aptoUberBlack).length,
    aptoFamilia: vehicles.filter(v => v.aptoFamilia).length,
    aptoUsoDiario: vehicles.filter(v => v.aptoUsoDiario).length,
  };

  console.log('--- STATS ---');
  console.table(stats);
  console.log('-------------\n');

  printCategoryReport('aptoCarga', report.aptoCarga.mismatches);
  printCategoryReport('aptoEntrega', report.aptoEntrega.mismatches);
  printCategoryReport('aptoUber', report.aptoUber.mismatches);
  printCategoryReport('aptoUberBlack', report.aptoUberBlack.mismatches);
  printCategoryReport('aptoFamilia', report.aptoFamilia.mismatches);
  printCategoryReport('aptoUsoDiario', report.aptoUsoDiario.mismatches);

  console.log('\n--- MANUAL REVIEW CARDS ---');
  console.log('\n[aptoUberBlack List]');
  lists.aptoUberBlack.forEach(c => console.log(` - ${c}`));
  console.log('\n[aptoCarga List]');
  lists.aptoCarga.forEach(c => console.log(` - ${c}`));

  console.log('\n--- END REPORT ---');
}

function printCategoryReport(category: string, mismatches: string[]) {
  console.log(`\n### ${category} (${mismatches.length} issues)`);
  if (mismatches.length > 0) {
    mismatches.slice(0, 20).forEach(m => console.log(m));
    if (mismatches.length > 20) console.log(`... and ${mismatches.length - 20} more`);
  } else {
    console.log('✅ No obvious issues found.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
