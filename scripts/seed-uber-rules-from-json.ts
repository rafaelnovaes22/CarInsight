
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { UberRulesRepository } from '../src/services/uber-rules-repository.service';

const prisma = new PrismaClient();
const uberRulesRepository = new UberRulesRepository();

interface UberRulesByModality {
    uberX: { eligible: any[] };
    uberComfort: { eligible: any[] };
    uberBlack: { eligible: any[] };
    uberXL: { eligible: any[] };
    moto: { eligible: any[] };
}

async function main() {
    console.log('🚀 Seeding Uber Rules from JSON...');

    const jsonPath = path.resolve(process.cwd(), 'uber_api_response.json');
    if (!fs.existsSync(jsonPath)) {
        console.error('❌ uber_api_response.json not found!');
        process.exit(1);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const json = JSON.parse(rawData);

    if (json.status !== 'success' || !json.data) {
        console.error('❌ Invalid JSON format');
        process.exit(1);
    }

    const citySlug = 'sao-paulo';
    const rules: UberRulesByModality = {
        uberX: { eligible: [] },
        uberComfort: { eligible: [] },
        uberBlack: { eligible: [] },
        uberXL: { eligible: [] },
        moto: { eligible: [] }
    };

    let totalModels = 0;

    // Iterate Brands
    for (const [brand, models] of Object.entries(json.data) as [string, any][]) {
        // Iterate Models
        for (const [model, rulesString] of Object.entries(models) as [string, string][]) {
            totalModels++;

            // "1996 (Envios Carro) / 2011 (UberX, Prioridade) / ..."
            const chunks = rulesString.split('/').map(c => c.trim()).filter(Boolean);

            for (const chunk of chunks) {
                // "2011 (UberX, Prioridade)"
                const m = chunk.match(/(19\d{2}|20\d{2})\s*\(([^)]*)\)/);
                if (!m) continue;

                const year = parseInt(m[1], 10);
                const categories = m[2]; // "UberX, Prioridade"

                const cats = mapCategories(categories);

                for (const cat of cats) {
                    if (rules[cat]) {
                        rules[cat].eligible.push({
                            brand,
                            model,
                            minYear: year,
                            raw: rulesString
                        });
                    }
                }
            }
        }
    }

    console.log(`\n📊 Parsed Statistics:`);
    console.log(`- UberX: ${rules.uberX.eligible.length} rules`);
    console.log(`- Comfort: ${rules.uberComfort.eligible.length} rules`);
    console.log(`- Black: ${rules.uberBlack.eligible.length} rules`);
    console.log(`- XL: ${rules.uberXL.eligible.length} rules`);
    console.log(`- Moto: ${rules.moto.eligible.length} rules`);

    // Flatten for DB
    const allRules: any[] = [];

    // Helper to add
    const add = (category: string, list: any[]) => {
        list.forEach(item => {
            allRules.push({
                citySlug,
                category,
                brand: item.brand,
                model: item.model,
                minYear: item.minYear,
                raw: item.raw,
                fetchedAt: new Date(),
                sourceUrl: 'https://www.uber.com/api/getEligibleVehiclesForCity?localeCode=pt-BR',
                // implementsAccessible not in schema based on prisma file view, but if repository handles it, let's stick to repository interface
            });
        });
    };

    add('uberX', rules.uberX.eligible);
    add('uberComfort', rules.uberComfort.eligible);
    add('uberBlack', rules.uberBlack.eligible);
    add('uberXL', rules.uberXL.eligible);
    add('moto', rules.moto.eligible);

    console.log(`\n💾 Saving ${allRules.length} rules to database...`);
    await uberRulesRepository.replaceAllForCity(citySlug, allRules);

    console.log('✅ Done!');
    await prisma.$disconnect();
}

function mapCategories(catStr: string): string[] {
    const raw = catStr.toLowerCase();
    const parts = raw.split(',').map(s => s.trim());
    const out = new Set<string>();

    for (const p of parts) {
        if (p === 'uberx' || p === 'uber x') out.add('uberX');
        else if (p === 'comfort' || p === 'comfort planet') out.add('uberComfort');
        else if (p === 'black' || p === 'black bag') out.add('uberBlack');
        else if (p === 'uberxl' || p === 'xl') out.add('uberXL');
        else if (p === 'moto') out.add('moto');
        // Ignore others like 'envios', 'bag', 'prioridade' for now unless critical
        // actually 'priority' -> usually mapped to X or Comfort? Left out for now to be strict.
    }
    return Array.from(out);
}

main().catch(console.error);
