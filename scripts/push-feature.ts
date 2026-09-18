import { execFileSync } from 'node:child_process';
import { assertFeaturePush } from './push-target';

function gitOutput(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function checkedBranch(): string {
  const branch = gitOutput(['branch', '--show-current']);
  const defaultBranch = gitOutput(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(
    /^origin\//,
    ''
  );
  const fetchUrl = gitOutput(['remote', 'get-url', 'origin']);
  const pushUrls = gitOutput(['remote', 'get-url', '--push', '--all', 'origin']).split(/\r?\n/);
  assertFeaturePush(branch, defaultBranch, [fetchUrl, ...pushUrls]);
  return branch;
}

export function pushFeatureBranch(): void {
  const branch = checkedBranch();
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Execute npm run push:safe para localizar o CLI npm.');
  execFileSync(process.execPath, [npmCli, 'run', 'verify:strict'], { stdio: 'inherit' });
  // Verification hooks must not silently change the destination selected by the caller.
  if (checkedBranch() !== branch)
    throw new Error('Branch mudou durante a verificação; push cancelado.');
  execFileSync('git', ['push', '--set-upstream', 'origin', `HEAD:refs/heads/${branch}`], {
    stdio: 'inherit',
  });
  console.log(JSON.stringify({ event: 'feature_branch_pushed', branch, remote: 'origin' }));
}

if (require.main === module) pushFeatureBranch();
