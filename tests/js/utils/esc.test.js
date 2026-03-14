import { describe, it, expect } from 'vitest';
import { esc } from '../../../mee6/web/static/js/utils/esc.js';

describe('esc utility', () => {
  it('escapes ampersands', () => {
    expect(esc('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes less than signs', () => {
    expect(esc('foo < bar')).toBe('foo &lt; bar');
  });

  it('escapes greater than signs', () => {
    expect(esc('foo > bar')).toBe('foo &gt; bar');
  });

  it('escapes double quotes', () => {
    expect(esc('foo "bar"')).toBe('foo &quot;bar&quot;');
  });

  it('handles null and undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('handles numbers', () => {
    expect(esc(123)).toBe('123');
  });

  it('handles strings with mixed special characters', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('handles empty strings', () => {
    expect(esc('')).toBe('');
  });

  it('does not escape safe characters', () => {
    expect(esc('Hello World 123!')).toBe('Hello World 123!');
  });

  it('handles multiple ampersands', () => {
    expect(esc('a & b & c')).toBe('a &amp; b &amp; c');
  });
});
