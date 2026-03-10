import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { splitSqlStatements } = require('../../../tools/scripts/db/fix-migrations.cjs') as {
  splitSqlStatements: (sql: string) => string[];
};

describe('fix-migrations SQL splitter', () => {
  it('splits top-level SQL statements', () => {
    const sql = `
      -- table
      CREATE TABLE "A" ("id" TEXT);
      CREATE INDEX "A_id_idx" ON "A"("id");
    `;

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('CREATE TABLE "A"');
    expect(statements[1]).toContain('CREATE INDEX "A_id_idx"');
  });

  it('keeps DO $$ block as a single statement', () => {
    const sql = `
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'A_fk') THEN
              PERFORM 1;
          END IF;
      END $$;
      ALTER TABLE "A" ADD COLUMN "name" TEXT;
    `;

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0].trim().startsWith('DO $$')).toBe(true);
    expect(statements[1]).toContain('ALTER TABLE "A" ADD COLUMN "name" TEXT');
  });

  it('ignores semicolons inside strings and comments', () => {
    const sql = `
      INSERT INTO "A" ("id", "name") VALUES ('1', 'foo;bar');
      /* this comment ; should not split statements */
      UPDATE "A" SET "name" = 'bar;foo' WHERE "id" = '1';
    `;

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('foo;bar');
    expect(statements[1]).toContain('bar;foo');
  });
});
