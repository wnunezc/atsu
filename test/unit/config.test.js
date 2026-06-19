import { describe, expect, test } from 'vitest';
import '../../src/js/shared/config.js';

const {
  DEFAULT_SITE_CONFIG,
  getQuestionIdFromUrl,
  normalizeSiteConfig,
  normalizeImportedSettings,
  normalizeQuestionId,
  isSupportedOrigin
} = globalThis.ATSUConfig;

describe('ATSUConfig', () => {
  test.each([
    'enabled',
    'newPosts',
    'comments',
    'languageDetection',
    'mreDetection',
    'codePostDetection',
    'colors',
    'debug',
    'smartTemplates'
  ])('preserves explicit true and false for %s', (key) => {
    expect(normalizeSiteConfig({ [key]: false })[key]).toBe(false);
    expect(normalizeSiteConfig({ [key]: true })[key]).toBe(true);
  });

  test('sanitizes invalid enums, colors and suggestion limits', () => {
    const result = normalizeSiteConfig({
      expectedLanguage: 'FR',
      colorProfile: 'neon',
      commentMaxSuggestions: 99,
      rgbColors: {
        normal: 'red',
        visited: '#123456',
        closed: null
      }
    });

    expect(result.expectedLanguage).toBe('auto');
    expect(result.colorProfile).toBe('soft');
    expect(result.commentMaxSuggestions).toBe(3);
    expect(result.rgbColors).toEqual({
      normal: DEFAULT_SITE_CONFIG.rgbColors.normal,
      visited: '#123456',
      closed: DEFAULT_SITE_CONFIG.rgbColors.closed
    });
  });

  test('accepts only supported HTTPS origins', () => {
    expect(isSupportedOrigin('https://stackoverflow.com')).toBe(true);
    expect(isSupportedOrigin('https://es.stackoverflow.com')).toBe(true);
    expect(isSupportedOrigin('https://math.stackexchange.com')).toBe(true);
    expect(isSupportedOrigin('http://stackoverflow.com')).toBe(false);
    expect(isSupportedOrigin('https://stackoverflow.com.evil.test')).toBe(false);
  });

  test('normalizes imports and drops unsupported origins and unknown properties', () => {
    const result = normalizeImportedSettings({
      sites: {
        'https://stackoverflow.com': {
          enabled: true,
          comments: false,
          injected: 'discard me'
        },
        'https://evil.test': {
          enabled: true
        }
      },
      ignored: true
    });

    expect(result).toEqual({
      version: 3,
      sites: {
        'https://stackoverflow.com': {
          ...DEFAULT_SITE_CONFIG,
          enabled: true,
          comments: false
        }
      }
    });
    expect(result.sites['https://stackoverflow.com']).not.toHaveProperty('injected');
  });

  test('treats arrays and primitive imports as empty settings', () => {
    expect(normalizeImportedSettings([])).toEqual({ version: 3, sites: {} });
    expect(normalizeImportedSettings('invalid')).toEqual({ version: 3, sites: {} });
  });

  test('accepts only positive numeric Stack Exchange question IDs', () => {
    expect(normalizeQuestionId(123)).toBe('123');
    expect(normalizeQuestionId(' 456 ')).toBe('456');
    expect(normalizeQuestionId('/questions/not-an-id')).toBe('');
    expect(normalizeQuestionId('0')).toBe('');
    expect(normalizeQuestionId('-2')).toBe('');
  });

  test('extracts IDs only from valid question URLs', () => {
    expect(getQuestionIdFromUrl('/questions/123/example', 'https://stackoverflow.com')).toBe('123');
    expect(getQuestionIdFromUrl('https://stackoverflow.com/questions/456/example')).toBe('456');
    expect(getQuestionIdFromUrl('/users/123/example', 'https://stackoverflow.com')).toBe('');
    expect(getQuestionIdFromUrl('javascript:alert(1)', 'https://stackoverflow.com')).toBe('');
    expect(getQuestionIdFromUrl('https://evil.test/questions/123/example')).toBe('');
  });
});
