import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';

const rootUrl = new URL('../../', import.meta.url);
const sources = new Map([
  ['src/js/shared/config.js', readFileSync(new URL('src/js/shared/config.js', rootUrl), 'utf8')],
  ['src/js/shared/storage.js', readFileSync(new URL('src/js/shared/storage.js', rootUrl), 'utf8')]
]);
const backgroundSource = readFileSync(new URL('background.js', rootUrl), 'utf8');

function createBackgroundHarness() {
  const data = {};
  let messageListener;
  let context;
  const chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: structuredClone(data[key]) };
        },
        async set(values) {
          Object.assign(data, structuredClone(values));
        }
      }
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      }
    },
    tabs: {
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      async query() {
        return [];
      }
    },
    action: {
      async setBadgeText() {},
      async setBadgeBackgroundColor() {}
    }
  };

  context = vm.createContext({
    chrome,
    console,
    URL,
    Date,
    JSON,
    Object,
    Array,
    Promise,
    RegExp,
    String,
    Number,
    Boolean,
    Math,
    structuredClone,
    setTimeout,
    clearTimeout,
    importScripts(...paths) {
      for (const path of paths) {
        vm.runInContext(sources.get(path), context, { filename: path });
      }
    }
  });
  vm.runInContext(backgroundSource, context, { filename: 'background.js' });

  async function dispatch(message, sender = {}) {
    return new Promise((resolve) => {
      const asyncResponse = messageListener(message, sender, resolve);
      if (!asyncResponse) {
        resolve(undefined);
      }
    });
  }

  return { data, dispatch };
}

describe('background message validation', () => {
  test('normalizes a supplied site URL to its supported origin before saving', async () => {
    const harness = createBackgroundHarness();
    const response = await harness.dispatch({
      action: 'ATSU_SAVE_SITE_CONFIG',
      origin: 'https://stackoverflow.com/questions/123/example',
      config: { enabled: true, comments: false }
    });

    expect(response.ok).toBe(true);
    expect(response.origin).toBe('https://stackoverflow.com');
    expect(harness.data.atsu_v2_settings.sites).toHaveProperty('https://stackoverflow.com');
    expect(harness.data.atsu_v2_settings.sites).not.toHaveProperty('https://stackoverflow.com/questions/123/example');
  });

  test('returns a controlled error for invalid visited-question input', async () => {
    const harness = createBackgroundHarness();
    const response = await harness.dispatch({
      action: 'ATSU_MARK_QUESTION_VISITED',
      origin: 'https://stackoverflow.com',
      questionId: 'not-an-id'
    });

    expect(response.ok).toBe(false);
    expect(response.error).toBe('Invalid question ID.');
  });

  test('rejects unknown actions without changing storage', async () => {
    const harness = createBackgroundHarness();
    const response = await harness.dispatch({ action: 'ATSU_UNKNOWN' });

    expect(response).toEqual({ ok: false, error: 'Unknown ATSU action.' });
    expect(harness.data).toEqual({});
  });
});
