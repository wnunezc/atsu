import { describe, expect, test } from 'vitest';
import '../../src/js/shared/config.js';
import '../../src/js/shared/storage.js';

const { createVisitedQuestionStore } = globalThis.ATSUStorage;

function createMemoryStorage(initial = {}, writeDelay = 0) {
  const data = structuredClone(initial);
  return {
    data,
    async get(key) {
      return { [key]: structuredClone(data[key]) };
    },
    async set(values) {
      if (writeDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, writeDelay));
      }
      Object.assign(data, structuredClone(values));
    }
  };
}

describe('visited question storage', () => {
  test('serializes concurrent writes without losing IDs', async () => {
    const storage = createMemoryStorage({}, 5);
    const store = createVisitedQuestionStore({
      storage,
      key: 'visited',
      maxIdsPerOrigin: 5000
    });

    await Promise.all([
      store.markVisited('https://stackoverflow.com', '101'),
      store.markVisited('https://stackoverflow.com', '102'),
      store.markVisited('https://stackoverflow.com', '103')
    ]);

    expect(await store.getIds('https://stackoverflow.com')).toEqual(['103', '102', '101']);
  });

  test('deduplicates IDs and moves the latest visit to the front', async () => {
    const storage = createMemoryStorage();
    const store = createVisitedQuestionStore({ storage, key: 'visited', maxIdsPerOrigin: 5000 });

    await store.markVisited('https://stackoverflow.com', '101');
    await store.markVisited('https://stackoverflow.com', '102');
    await store.markVisited('https://stackoverflow.com', '101');

    expect(await store.getIds('https://stackoverflow.com')).toEqual(['101', '102']);
  });

  test('enforces the configured per-origin limit', async () => {
    const storage = createMemoryStorage();
    const store = createVisitedQuestionStore({ storage, key: 'visited', maxIdsPerOrigin: 2 });

    await store.markVisited('https://stackoverflow.com', '101');
    await store.markVisited('https://stackoverflow.com', '102');
    await store.markVisited('https://stackoverflow.com', '103');

    expect(await store.getIds('https://stackoverflow.com')).toEqual(['103', '102']);
  });

  test('rejects unsupported origins and invalid question IDs', async () => {
    const storage = createMemoryStorage();
    const store = createVisitedQuestionStore({ storage, key: 'visited', maxIdsPerOrigin: 5000 });

    await expect(store.markVisited('https://evil.test', '101')).rejects.toThrow('Unsupported origin');
    await expect(store.markVisited('https://stackoverflow.com/questions', '101')).rejects.toThrow('Unsupported origin');
    await expect(store.markVisited('https://stackoverflow.com', 'not-an-id')).rejects.toThrow('Invalid question ID');
    expect(storage.data).toEqual({});
  });

  test('filters corrupt persisted values when reading', async () => {
    const storage = createMemoryStorage({
      visited: {
        version: 99,
        origins: {
          'https://stackoverflow.com': ['101', null, 'bad', 102, '101'],
          'https://evil.test': ['999']
        }
      }
    });
    const store = createVisitedQuestionStore({ storage, key: 'visited', maxIdsPerOrigin: 5000 });

    expect(await store.getIds('https://stackoverflow.com')).toEqual(['101', '102']);
    expect(await store.getIds('https://evil.test')).toEqual([]);
  });
});
