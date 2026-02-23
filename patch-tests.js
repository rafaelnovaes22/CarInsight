const fs = require('fs');
const path = require('path');

function patchFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${filePath}`);
}

// 1. guardrails.test.ts
const e2ePath = path.join(__dirname, 'tests/e2e/security/guardrails.test.ts');
if (fs.existsSync(e2ePath)) {
  let content = fs.readFileSync(e2ePath, 'utf8');
  // replace `it('...', () => {` with `it('...', async () => {`
  content = content.replace(/it\('([^']+)', \(\) => {/g, "it('$1', async () => {");

  // replace `const result = service.validateInput` with `const result = await service.validateInput`
  content = content.replace(
    /const result = service\.validateInput/g,
    'const result = await service.validateInput'
  );

  // replace direct `service.validateInput` calls in loops with `await service.validateInput`
  content = content.replace(/service\.validateInput\(/g, 'await service.validateInput(');
  // Revert any double await
  content = content.replace(/await await service/g, 'await service');

  fs.writeFileSync(e2ePath, content, 'utf8');
  console.log(`Patched ${e2ePath}`);
}

// 2. message-persistence.test.ts
const mpPath = path.join(__dirname, 'tests/unit/message-persistence.test.ts');
if (fs.existsSync(mpPath)) {
  let content = fs.readFileSync(mpPath, 'utf8');
  content = content.replace(
    /validateInput: vi\.fn\(\)\.mockReturnValue\(\{ allowed: true/g,
    'validateInput: vi.fn().mockResolvedValue({ allowed: true'
  );
  fs.writeFileSync(mpPath, content, 'utf8');
  console.log(`Patched ${mpPath}`);
}

// 3. basic-performance.test.ts
const perfPath = path.join(__dirname, 'tests/performance/basic-performance.test.ts');
if (fs.existsSync(perfPath)) {
  let content = fs.readFileSync(perfPath, 'utf8');
  // replace `it('...', () => {` with `it('...', async () => {`
  content = content.replace(
    /it\('should validate input in less than 5ms', \(\) => {/g,
    "it('should validate input in less than 5ms', async () => {"
  );
  content = content.replace(
    /it\('should detect prompt injection in less than 10ms', \(\) => {/g,
    "it('should detect prompt injection in less than 10ms', async () => {"
  );
  content = content.replace(
    /it\('should handle 100 validations in less than 500ms', \(\) => {/g,
    "it('should handle 100 validations in less than 500ms', async () => {"
  );
  content = content.replace(
    /it\('should have p95 latency under 5ms for guardrail validation', \(\) => {/g,
    "it('should have p95 latency under 5ms for guardrail validation', async () => {"
  );

  content = content.replace(
    /const result = guardrails\.validateInput/g,
    'const result = await guardrails.validateInput'
  );
  content = content.replace(/guardrails\.validateInput\(/g, 'await guardrails.validateInput(');
  content = content.replace(/await await guardrails/g, 'await guardrails');

  fs.writeFileSync(perfPath, content, 'utf8');
  console.log(`Patched ${perfPath}`);
}
