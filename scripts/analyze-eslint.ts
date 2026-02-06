import * as fs from 'fs';

interface EslintMessage {
  ruleId: string;
  severity: number;
  message: string;
  line: number;
  column: number;
}

interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
  warningCount: number;
  errorCount: number;
}

const data: EslintResult[] = JSON.parse(fs.readFileSync('eslint.json', 'utf-8'));

// Count by rule
const ruleCount: Record<string, number> = {};
const filesByRule: Record<string, string[]> = {};

for (const file of data) {
  for (const msg of file.messages) {
    const rule = msg.ruleId || 'unknown';
    ruleCount[rule] = (ruleCount[rule] || 0) + 1;
    if (!filesByRule[rule]) filesByRule[rule] = [];
    if (!filesByRule[rule].includes(file.filePath)) {
      filesByRule[rule].push(file.filePath);
    }
  }
}

console.log('\n=== WARNINGS BY RULE ===');
Object.entries(ruleCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([rule, count]) => {
    console.log(`${rule}: ${count} (in ${filesByRule[rule].length} files)`);
  });

// Files with most issues
console.log('\n=== FILES WITH MOST ISSUES ===');
data
  .filter(f => f.warningCount + f.errorCount > 0)
  .sort((a, b) => b.warningCount + b.errorCount - (a.warningCount + a.errorCount))
  .slice(0, 15)
  .forEach(f => {
    const shortPath = f.filePath.replace(/.*faciliauto-mvp-v2\\/, '');
    console.log(`${shortPath}: ${f.warningCount} warnings, ${f.errorCount} errors`);
  });
