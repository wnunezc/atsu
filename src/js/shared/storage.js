((root) => {
  'use strict';

  const { isSupportedOrigin, normalizeQuestionId } = root.ATSUConfig;

  function createVisitedQuestionStore({ storage, key, maxIdsPerOrigin = 5000 }) {
    if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
      throw new TypeError('A compatible storage adapter is required.');
    }
    if (typeof key !== 'string' || !key) {
      throw new TypeError('A storage key is required.');
    }

    const limit = Math.max(1, Math.trunc(Number(maxIdsPerOrigin) || 5000));
    let writeQueue = Promise.resolve();

    function normalizeStore(value) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const rawOrigins = source.origins && typeof source.origins === 'object' && !Array.isArray(source.origins)
        ? source.origins
        : {};
      const origins = {};

      for (const [origin, rawIds] of Object.entries(rawOrigins)) {
        if (!isSupportedOrigin(origin) || !Array.isArray(rawIds)) {
          continue;
        }

        const ids = [];
        for (const value of rawIds) {
          const id = normalizeQuestionId(value);
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
          if (ids.length >= limit) {
            break;
          }
        }
        origins[origin] = ids;
      }

      return { version: 1, origins };
    }

    async function readStore() {
      const result = await storage.get(key);
      return normalizeStore(result ? result[key] : null);
    }

    async function getIds(origin) {
      if (!isSupportedOrigin(origin)) {
        return [];
      }
      await writeQueue.catch(() => {});
      const store = await readStore();
      return store.origins[origin] || [];
    }

    function markVisited(origin, questionId) {
      if (!isSupportedOrigin(origin)) {
        return Promise.reject(new TypeError('Unsupported origin.'));
      }
      const id = normalizeQuestionId(questionId);
      if (!id) {
        return Promise.reject(new TypeError('Invalid question ID.'));
      }

      writeQueue = writeQueue.catch(() => {}).then(async () => {
        const store = await readStore();
        const existing = store.origins[origin] || [];
        const next = [id, ...existing.filter((storedId) => storedId !== id)].slice(0, limit);
        store.origins[origin] = next;
        await storage.set({ [key]: store });
        return { origin, questionId: id, visitedQuestionIds: next };
      });

      return writeQueue;
    }

    return Object.freeze({ getIds, markVisited });
  }

  root.ATSUStorage = Object.freeze({ createVisitedQuestionStore });
})(globalThis);
