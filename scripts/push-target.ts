const PERSONAL_REPOSITORY =
  /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)rafaelnovaes22\/CarInsight(?:\.git)?$/i;

export function assertFeaturePush(
  branch: string,
  defaultBranch: string,
  remoteUrls: readonly string[]
): void {
  const isFeature = /^(codex|feat|fix|docs|test|chore|refactor|perf)\/.+/.test(branch);
  if (!defaultBranch || !isFeature || branch === defaultBranch)
    throw new Error(
      `Push bloqueado para '${branch}': use uma branch própria, diferente da default.`
    );
  if (remoteUrls.length === 0 || remoteUrls.some(url => !PERSONAL_REPOSITORY.test(url)))
    throw new Error(
      'Push bloqueado: origin deve apontar exclusivamente para rafaelnovaes22/CarInsight.'
    );
}
