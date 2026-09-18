import { describe, expect, it } from 'vitest';
import { assertFeaturePush } from '../../../scripts/push-target';

const origin = 'https://github.com/rafaelnovaes22/CarInsight.git';

describe('feature push destination', () => {
  it.each(['main', 'master', 'develop', '', 'HEAD'])(
    'blocks shared or detached branch %s',
    branch => {
      expect(() => assertFeaturePush(branch, 'main', [origin])).toThrow('branch própria');
    }
  );

  it('blocks a feature-named default branch and unknown default', () => {
    expect(() => assertFeaturePush('codex/default', 'codex/default', [origin])).toThrow();
    expect(() => assertFeaturePush('codex/change', '', [origin])).toThrow();
  });

  it.each([
    [],
    ['https://github.com/example/CarInsight.git'],
    [origin, 'git@github.com:example/CarInsight.git'],
    ['https://github.com/rafaelnovaes22/CarInsight.git/unexpected'],
  ])('rejects missing or unauthorized remote URLs %#', (...urls: string[]) => {
    expect(() => assertFeaturePush('codex/change', 'main', urls)).toThrow('origin');
  });

  it('accepts the personal repository over HTTPS and SSH', () => {
    expect(() =>
      assertFeaturePush('codex/change', 'main', [
        origin,
        'git@github.com:rafaelnovaes22/CarInsight.git',
      ])
    ).not.toThrow();
  });
});
