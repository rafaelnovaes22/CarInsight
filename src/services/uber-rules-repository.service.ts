import { prisma } from '../lib/prisma';

export type UberCategory = string;

export interface UberRuleRow {
  citySlug: string;
  category: UberCategory;
  brand: string;
  model: string;
  minYear: number;
  raw: string;
  fetchedAt: Date;
  sourceUrl: string;
}

export class UberRulesRepository {
  async replaceAllForCity(citySlug: string, rows: UberRuleRow[]): Promise<void> {
    await prisma.uberEligibleVehicleRule.deleteMany({ where: { citySlug } });

    if (rows.length === 0) return;

    await prisma.uberEligibleVehicleRule.createMany({
      data: rows.map(r => ({
        citySlug: r.citySlug,
        category: r.category,
        brand: r.brand,
        model: r.model,
        minYear: r.minYear,
        raw: r.raw,
        fetchedAt: r.fetchedAt,
        sourceUrl: r.sourceUrl,
      })),
      skipDuplicates: true,
    });
  }

  async getLatestForCity(citySlug: string): Promise<{ fetchedAt: Date; sourceUrl: string } | null> {
    const row = await prisma.uberEligibleVehicleRule.findFirst({
      where: { citySlug },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true, sourceUrl: true },
    });

    return row ?? null;
  }

  async listByCity(citySlug: string): Promise<UberRuleRow[]> {
    const rows = await prisma.uberEligibleVehicleRule.findMany({
      where: { citySlug },
      select: {
        citySlug: true,
        category: true,
        brand: true,
        model: true,
        minYear: true,
        raw: true,
        fetchedAt: true,
        sourceUrl: true,
      },
    });

    return rows as any;
  }
}

export const uberRulesRepository = new UberRulesRepository();
