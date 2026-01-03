
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * CI Check Script
 * Simulates the GitHub Actions pipeline locally to ensure code quality before pushing.
 */

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function runCommand(command: string, args: string[], description: string): Promise<boolean> {
    console.log(`\n${BOLD}🔄 Step: ${description}${RESET}`);
    console.log(`${YELLOW}> ${command} ${args.join(' ')}${RESET}`);

    return new Promise((resolve) => {
        const startTime = Date.now();
        // On Windows, npm commands need shell: true
        const proc = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        proc.on('close', (code) => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            if (code === 0) {
                console.log(`${GREEN}✅ ${description} passed in ${duration}s${RESET}`);
                resolve(true);
            } else {
                console.log(`${RED}❌ ${description} failed (exit code ${code})${RESET}`);
                resolve(false);
            }
        });
    });
}

async function checkSecrets(): Promise<boolean> {
    console.log(`\n${BOLD}🔄 Step: Secret Scanning${RESET}`);
    const patterns = [
        /gsk_[a-zA-Z0-9]{20,}/, // Groq
        /sk-[a-zA-Z0-9]{20,}/,  // OpenAI
        /EAA[a-zA-Z0-9]{100,}/,  // Meta
    ];

    let hasSecrets = false;
    // Simple recursive scan ignoring node_modules and .git
    function scanDir(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (['node_modules', '.git', 'dist', 'coverage', '.next'].includes(file)) continue;
            if (file.startsWith('.env')) continue;

            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDir(fullPath);
            } else {
                if (!/\.(ts|js|json|md|yml|env.*)$/.test(file)) continue;

                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    for (const pattern of patterns) {
                        if (pattern.test(content)) {
                            console.log(`${RED}❌ Secret found in: ${fullPath}${RESET}`);
                            hasSecrets = true;
                        }
                    }
                } catch (e) {
                    // Ignore read errors
                }
            }
        }
    }

    try {
        scanDir(process.cwd());
        if (!hasSecrets) {
            console.log(`${GREEN}✅ No secrets found${RESET}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error scanning secrets:', error);
        return false;
    }
}

async function main() {
    console.log(`${BOLD}🚀 Starting Local CI Check...${RESET}`);
    console.log(`${YELLOW}This will run: Secrets Check -> Lint -> Format -> Build -> Tests${RESET}`);

    // 1. Secrets
    if (!await checkSecrets()) process.exit(1);

    // 2. Lint
    if (!await runCommand('npm', ['run', 'lint'], 'Linting')) process.exit(1);

    // 3. Format Check
    if (!await runCommand('npm', ['run', 'format:check'], 'Format Check')) {
        console.log(`${YELLOW}💡 Tip: Run 'npm run format' to fix formatting issues automatically.${RESET}`);
        process.exit(1);
    }

    // 4. Build
    if (!await runCommand('npm', ['run', 'build'], 'TypeScript Build')) process.exit(1);

    // 5. Unit Tests
    if (!await runCommand('npm', ['run', 'test:unit'], 'Unit Tests')) process.exit(1);

    // 6. Integration Tests
    if (!await runCommand('npm', ['run', 'test:integration'], 'Integration Tests')) process.exit(1);

    console.log(`\n${GREEN}${BOLD}✨ All CI checks passed! Your code is ready to push.${RESET}\n`);
}

main().catch(console.error);
