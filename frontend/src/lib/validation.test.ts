import { describe, expect, it } from 'vitest';
import { isEmail, parseNumber, PROJECT_ID_PATTERN } from './validation';

describe('parseNumber', () => {
  it('returns null for empty input and NaN for junk', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('1e999')).toBeNaN();
  });

  it('parses numbers with surrounding whitespace', () => {
    expect(parseNumber(' 0.75 ')).toBe(0.75);
    expect(parseNumber('4000')).toBe(4000);
    expect(parseNumber('-1')).toBe(-1);
  });
});

describe('isEmail', () => {
  it('accepts an ordinary address and rejects the obvious mistakes', () => {
    expect(isEmail('demo@driftguard.local')).toBe(true);
    expect(isEmail('  demo@driftguard.local ')).toBe(true);
    expect(isEmail('demo@driftguard')).toBe(false);
    expect(isEmail('demo driftguard.local')).toBe(false);
    expect(isEmail('@driftguard.local')).toBe(false);
  });
});

describe('PROJECT_ID_PATTERN', () => {
  it('allows letters, digits, dash and underscore up to 64 characters', () => {
    expect(PROJECT_ID_PATTERN.test('claude-dev_1')).toBe(true);
    expect(PROJECT_ID_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(PROJECT_ID_PATTERN.test('a'.repeat(65))).toBe(false);
    expect(PROJECT_ID_PATTERN.test('has space')).toBe(false);
    expect(PROJECT_ID_PATTERN.test('')).toBe(false);
  });
});
