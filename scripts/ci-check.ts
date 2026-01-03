
import { execSync } from 'child_process';
import { logger } from '../src/lib/logger';

/**
 * CI Check Script
 * 
 * Runs all validation steps required before pushing code.
 * - Format Check
 * - Lint
 * - Build (Type Check)
 * - Tests
 */

const STEPS = [
    {
        name: '🎨 Format Check',
        command: 'npm run format:check',
        fixCommand: 'npm run format',
    },
    {
        name: '🧹 Lint',
        command: 'npm run lint',
        fixCommand: 'npm run lint:fix',
    },
    {
        name: '🏗️  Build (Type Check)',
        command: 'npm run build',
    },
    {
        name: '🧪 Tests',
        command: 'npm run test:run',
    }
];

async function runCI() {
    console.log('\n🚀 Starting CI Check Sequence...\n');

    for (const step of STEPS) {
        console.log(`running: ${step.name}...`);
        try {
            execSync(step.command, { stdio: 'inherit' });
            console.log(`✅ ${step.name} Passed\n`);
        } catch (error) {
            console.error(`\n❌ ${step.name} FAILED!`);
            if (step.fixCommand) {
                console.log(`💡 Try running: ${step.fixCommand}`);
            }
            process.exit(1);
        }
    }

    console.log('🎉 ALL CHECKS PASSED! Ready to push.');
}

runCI().catch(console.error);
