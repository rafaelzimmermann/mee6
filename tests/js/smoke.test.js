import { describe, it, expect } from 'vitest';

describe('Testing Infrastructure Setup', () => {
  it('can run tests', () => {
    expect(true).toBe(true);
  });

  it('has proper test environment', () => {
    expect(typeof window).toBeDefined();
  });
});
