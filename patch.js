const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');

s = s.replace(
    /generator client \{[\s\S]*?\}/,
    'generator client {\n  provider = "prisma-client-js"\n  previewFeatures = ["postgresqlExtensions"]\n}'
);

s = s.replace(
    /datasource db \{[\s\S]*?\}/,
    'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n  extensions = [vector]\n}'
);

s = s.replace(
    /embedding\s+String\?(?=\n|\r)/,
    'embedding            Unsupported("vector(1536)")?'
);

fs.writeFileSync('prisma/schema.prisma', s);
console.log('Schema updated.');
