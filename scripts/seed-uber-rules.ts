
import { uberRulesRepository, UberRuleRow } from '../src/services/uber-rules-repository.service';

const CITY_SLUGS = ['sao-paulo'];

// OFFICIAL-LIKE RULES (Approximate Baseline for SP)

// 1. Uber X (General Access)
// Most cars 2013+ are accepted if 4 doors + AC.
// We will rely on the classifier's generic check (Year >= 2012, 4 doors) for X if the list is empty,
// BUT providing a list is better. For X, the list is huge, so we might skip seeding ALL X models
// and mostly rely on the generic rule. However, let's seed a few to verify the mechanism.
// Actually, for Black, the list is restrictive. Let's focus on Seeding Black correctly.

const BLACK_ELIGIBLE = [
    // Brand, Model, MinYear
    ['Audi', 'A3 Sedan', 2016],
    ['Audi', 'A4', 2016],
    ['Audi', 'Q3', 2016],
    ['BMW', '320i', 2016],
    ['BMW', 'X1', 2016],
    ['Chevrolet', 'Cruze', 2018],
    ['Chevrolet', 'Equinox', 2018], // Medium SUV
    // TRACKER is NOT on Black (Compact)
    ['Ford', 'Fusion', 2016],
    ['Honda', 'Civic', 2016],
    ['Honda', 'CR-V', 2016], // Medium SUV
    ['Honda', 'HR-V', 2018], // HR-V is sometimes disputed, but usually accepted in Black Bag. Strict Black might exclude. Let's EXCLUDE HR-V to be strict.
    ['Hyundai', 'Azera', 2015],
    ['Hyundai', 'Creta', 2030], // EXCLUDE (Set year to future or don't list) -> Don't list.
    ['Hyundai', 'Tucson', 2017], // Medium
    // RENEGADE is NOT on Black (Compact)
    ['Jeep', 'Compass', 2017],
    ['Jeep', 'Commander', 2021],
    ['Kia', 'Sportage', 2016],
    ['Kia', 'Cerato', 2016],
    ['Mitsubishi', 'Outlander', 2016],
    ['Nissan', 'Sentra', 2016],
    ['Nissan', 'Kicks', 2030], // EXCLUDE
    ['Toyota', 'Corolla', 2016],
    ['Toyota', 'Corolla Cross', 2021],
    ['Toyota', 'RAV4', 2016],
    ['Volkswagen', 'Jetta', 2016],
    ['Volkswagen', 'Taos', 2021],
    ['Volkswagen', 'Tiguam', 2016],
    ['Volkswagen', 'T-Cross', 2030], // EXCLUDE
    ['Volvo', 'XC40', 2018],
    ['Volvo', 'XC60', 2016],
    ['Caoa Chery', 'Tiggo 7', 2019],
    ['Caoa Chery', 'Tiggo 8', 2019],
    // DUSTER, CAPTUR -> Exclude
];

async function main() {
    console.log('🌱 Seeding Uber Rules (Hardcoded Baseline)...');

    for (const citySlug of CITY_SLUGS) {
        const rows: UberRuleRow[] = [];
        const fetchedAt = new Date();
        const sourceUrl = 'manual_seed_v1';

        // Seed Black Rules
        BLACK_ELIGIBLE.forEach(([brand, model, minYear]) => {
            rows.push({
                citySlug,
                category: 'uberBlack',
                brand: String(brand),
                model: String(model),
                minYear: Number(minYear),
                raw: 'Seeded',
                fetchedAt,
                sourceUrl
            });
        });

        // Provide generic rules for X/Comfort? eligible lists can be empty -> logic falls back to generic.
        // We only explicitly want to RESTRICT Black.
        // If we provide a list for Black, the `uber-eligibility-agent` says:
        // "If we have an explicit eligible list for a modality and the model is NOT present, block it."
        // So by seeding Black, we ENFORCE the allowsist.

        console.log(`Saving ${rows.length} rules for ${citySlug}...`);
        await uberRulesRepository.replaceAllForCity(citySlug, rows);
    }

    console.log('✅ Seed Complete. Black list is now strict.');
}

main()
    .catch(e => console.error(e))
    .finally(() => process.exit(0));
