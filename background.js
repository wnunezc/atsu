/*
 * ATSU 1.0.0 - Background service worker
 * Rescue/normalization build.
 *
 * Goals:
 * - Keep permissions small.
 * - Store one configuration per Stack Exchange origin.
 * - Provide a simple message bridge for popup/content scripts.
 * - Keep the toolbar badge useful without blocking promises.
 */

importScripts('src/js/shared/config.js', 'src/js/shared/storage.js');

const ATSU_STORAGE_KEY = 'atsu_v2_settings';
const ATSU_VISITED_KEY = 'atsu_v2_visited_questions';
const {
  DEFAULT_SETTINGS,
  clone,
  getSupportedOrigin,
  isSupportedOrigin,
  normalizeImportedSettings,
  normalizeSiteConfig
} = ATSUConfig;
const visitedQuestionStore = ATSUStorage.createVisitedQuestionStore({
  storage: chrome.storage.local,
  key: ATSU_VISITED_KEY,
  maxIdsPerOrigin: 5000
});

function getOriginFromUrl(rawUrl) {
  return getSupportedOrigin(rawUrl);
}

function isSupportedStackExchangeUrl(rawUrl) {
  return isSupportedOrigin(rawUrl);
}

async function getSettings() {
  const result = await chrome.storage.local.get(ATSU_STORAGE_KEY);
  const stored = result[ATSU_STORAGE_KEY];

  if (!stored || typeof stored !== 'object') {
    const initial = clone(DEFAULT_SETTINGS);
    await chrome.storage.local.set({ [ATSU_STORAGE_KEY]: initial });
    return initial;
  }

  return normalizeImportedSettings(stored);
}

async function saveSettings(settings) {
  const normalized = normalizeImportedSettings(settings);
  await chrome.storage.local.set({ [ATSU_STORAGE_KEY]: normalized });
  return normalized;
}

async function getVisitedQuestionIds(origin) {
  return visitedQuestionStore.getIds(origin);
}

async function markQuestionVisited(origin, questionId) {
  return visitedQuestionStore.markVisited(origin, questionId);
}


async function getSiteConfig(origin) {
  const settings = await getSettings();
  return normalizeSiteConfig(settings.sites[origin]);
}

async function saveSiteConfig(origin, config) {
  const settings = await getSettings();
  settings.sites[origin] = normalizeSiteConfig(config);
  await saveSettings(settings);
  return settings.sites[origin];
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length > 0 ? tabs[0] : null;
}

async function setBadgeFromUrl(rawUrl) {
  const supported = isSupportedStackExchangeUrl(rawUrl);

  if (!supported) {
    await chrome.action.setBadgeText({ text: 'Off' });
    await chrome.action.setBadgeBackgroundColor({ color: '#6a737c' });
    return;
  }

  const origin = getOriginFromUrl(rawUrl);
  const config = origin ? await getSiteConfig(origin) : normalizeSiteConfig();

  if (config.enabled) {
    await chrome.action.setBadgeText({ text: 'On' });
    await chrome.action.setBadgeBackgroundColor({ color: '#2f6f44' });
    return;
  }

  await chrome.action.setBadgeText({ text: 'New' });
  await chrome.action.setBadgeBackgroundColor({ color: '#c7801a' });
}


async function importSettings(payload) {
  const normalized = normalizeImportedSettings(payload);
  await saveSettings(normalized);
  return normalized;
}

async function resetAllSettings() {
  const fresh = clone(DEFAULT_SETTINGS);
  await saveSettings(fresh);
  return fresh;
}

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
  await chrome.action.setBadgeText({ text: '1.0' });
  await chrome.action.setBadgeBackgroundColor({ color: '#5f4b8b' });
});

chrome.tabs.onActivated.addListener(async () => {
  const tab = await getActiveTab();
  await setBadgeFromUrl(tab && tab.url ? tab.url : '');
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.active && tab.url) {
    await setBadgeFromUrl(tab.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const action = message && message.action;

    if (action === 'ATSU_GET_ACTIVE_STATE') {
      const tab = await getActiveTab();
      const rawUrl = tab && tab.url ? tab.url : '';
      const supported = isSupportedStackExchangeUrl(rawUrl);
      const origin = getOriginFromUrl(rawUrl);
      const config = origin ? await getSiteConfig(origin) : normalizeSiteConfig();

      sendResponse({
        ok: true,
        supported,
        origin,
        url: rawUrl,
        config
      });
      return;
    }

    if (action === 'ATSU_GET_CONTENT_STATE') {
      const rawUrl = sender && sender.tab && sender.tab.url ? sender.tab.url : message.url;
      const supported = isSupportedStackExchangeUrl(rawUrl);
      const origin = getOriginFromUrl(rawUrl);
      const config = origin ? await getSiteConfig(origin) : normalizeSiteConfig();

      const visitedQuestionIds = origin ? await getVisitedQuestionIds(origin) : [];

      sendResponse({
        ok: true,
        supported,
        origin,
        config,
        visitedQuestionIds
      });
      return;
    }

    if (action === 'ATSU_SAVE_SITE_CONFIG') {
      const origin = getOriginFromUrl(message.url || '') || message.origin;

      if (!origin || !isSupportedStackExchangeUrl(origin)) {
        sendResponse({ ok: false, error: 'Unsupported Stack Exchange URL.' });
        return;
      }

      const config = await saveSiteConfig(origin, message.config);
      await setBadgeFromUrl(origin);

      sendResponse({
        ok: true,
        origin,
        config
      });
      return;
    }


    if (action === 'ATSU_MARK_QUESTION_VISITED') {
      const origin = getOriginFromUrl(message.url || '') || message.origin;
      const result = await markQuestionVisited(origin, message.questionId);
      sendResponse({ ok: true, ...result });
      return;
    }


    if (action === 'ATSU_EXPORT_SETTINGS') {
      const settings = await getSettings();
      sendResponse({
        ok: true,
        settings: {
          ...settings,
          exportedAt: new Date().toISOString(),
          product: 'ATSU'
        }
      });
      return;
    }

    if (action === 'ATSU_IMPORT_SETTINGS') {
      const settings = await importSettings(message.settings);
      const tab = await getActiveTab();
      await setBadgeFromUrl(tab && tab.url ? tab.url : '');
      sendResponse({ ok: true, settings });
      return;
    }

    if (action === 'ATSU_RESET_ALL_SETTINGS') {
      const settings = await resetAllSettings();
      const tab = await getActiveTab();
      await setBadgeFromUrl(tab && tab.url ? tab.url : '');
      sendResponse({ ok: true, settings });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown ATSU action.' });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  });

  return true;
});
