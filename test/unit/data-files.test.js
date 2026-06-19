import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import '../../src/js/shared/config.js';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

describe('reference JSON files', () => {
  test('URL catalog metadata matches its unique supported entries', () => {
    const catalog = readJson('../../src/json/urls.json');
    const urls = catalog.items.map((item) => item.site_url);

    expect(catalog.type).toBe('site');
    expect(catalog.page).toBe(1);
    expect(catalog.total).toBe(catalog.items.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => globalThis.ATSUConfig.isSupportedOrigin(url))).toBe(true);
  });

  test.each(['en', 'es'])('%s language reference contains only string messages', (language) => {
    const data = readJson(`../../src/json/lang/${language}.json`);
    expect(typeof data.atsu_sugestion).toBe('string');

    for (const section of [data.qa, data.comment]) {
      expect(section).not.toBeNull();
      expect(Object.values(section).length).toBeGreaterThan(0);
      expect(Object.values(section).every((value) => typeof value === 'string' && value.trim())).toBe(true);
    }
  });
});
