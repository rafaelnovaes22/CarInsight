import { describe, it, expect } from 'vitest';

describe('Basic Integration Tests', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with async', async () => {
    const result = await Promise.resolve(true);
    expect(result).toBe(true);
  });
});
