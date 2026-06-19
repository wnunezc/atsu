((root) => {
  'use strict';

  const COLOR_PROFILES = Object.freeze({
    none: Object.freeze({ normal: '#2368a2', visited: '#5f4b8b', closed: '#6a737c' }),
    soft: Object.freeze({ normal: '#2368a2', visited: '#5f4b8b', closed: '#6a737c' }),
    medium: Object.freeze({ normal: '#0077cc', visited: '#6f42c1', closed: '#8a6d3b' }),
    strong: Object.freeze({ normal: '#d6006f', visited: '#551a8b', closed: '#77706f' }),
    custom: null
  });

  const DEFAULT_SITE_CONFIG = Object.freeze({
    enabled: false,
    newPosts: true,
    comments: true,
    languageDetection: true,
    expectedLanguage: 'auto',
    mreDetection: true,
    codePostDetection: true,
    colors: true,
    debug: false,
    smartTemplates: true,
    commentMaxSuggestions: 2,
    colorProfile: 'soft',
    rgbColors: Object.freeze({ ...COLOR_PROFILES.soft })
  });

  const DEFAULT_SETTINGS = Object.freeze({
    version: 3,
    sites: Object.freeze({})
  });

  const BOOLEAN_KEYS = Object.freeze([
    'enabled',
    'newPosts',
    'comments',
    'languageDetection',
    'mreDetection',
    'codePostDetection',
    'colors',
    'debug',
    'smartTemplates'
  ]);

  const SUPPORTED_HOST_RULES = Object.freeze([
    /(^|\.)stackoverflow\.com$/i,
    /(^|\.)serverfault\.com$/i,
    /(^|\.)superuser\.com$/i,
    /(^|\.)askubuntu\.com$/i,
    /(^|\.)stackapps\.com$/i,
    /(^|\.)stackexchange\.com$/i,
    /(^|\.)mathoverflow\.net$/i
  ]);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeColor(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : fallback;
  }

  function normalizeSiteConfig(config) {
    const source = isPlainObject(config) ? config : {};
    const profile = Object.prototype.hasOwnProperty.call(COLOR_PROFILES, source.colorProfile)
      ? source.colorProfile
      : DEFAULT_SITE_CONFIG.colorProfile;
    const profileColors = COLOR_PROFILES[profile] || DEFAULT_SITE_CONFIG.rgbColors;
    const sourceColors = isPlainObject(source.rgbColors) ? source.rgbColors : {};
    const normalized = clone(DEFAULT_SITE_CONFIG);

    for (const key of BOOLEAN_KEYS) {
      if (typeof source[key] === 'boolean') {
        normalized[key] = source[key];
      }
    }

    normalized.expectedLanguage = ['auto', 'EN', 'ES'].includes(source.expectedLanguage)
      ? source.expectedLanguage
      : DEFAULT_SITE_CONFIG.expectedLanguage;
    normalized.commentMaxSuggestions = Math.max(
      1,
      Math.min(3, Number.isFinite(Number(source.commentMaxSuggestions))
        ? Math.trunc(Number(source.commentMaxSuggestions))
        : DEFAULT_SITE_CONFIG.commentMaxSuggestions)
    );
    normalized.colorProfile = profile;
    normalized.colors = profile === 'none' ? false : normalized.colors;
    normalized.rgbColors = {
      normal: normalizeColor(sourceColors.normal, profileColors.normal),
      visited: normalizeColor(sourceColors.visited, profileColors.visited),
      closed: normalizeColor(sourceColors.closed, profileColors.closed)
    };

    return normalized;
  }

  function getSupportedOrigin(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:' || !SUPPORTED_HOST_RULES.some((rule) => rule.test(url.hostname))) {
        return null;
      }
      return url.origin;
    } catch {
      return null;
    }
  }

  function isSupportedOrigin(rawUrl) {
    return getSupportedOrigin(rawUrl) !== null;
  }

  function normalizeQuestionId(value) {
    const id = typeof value === 'number' || typeof value === 'string'
      ? String(value).trim()
      : '';
    return /^[1-9]\d*$/.test(id) ? id : '';
  }

  function getQuestionIdFromUrl(rawUrl, baseUrl) {
    try {
      const url = new URL(rawUrl, baseUrl);
      if (!isSupportedOrigin(url.origin)) {
        return '';
      }
      const match = url.pathname.match(/^\/questions\/([1-9]\d*)(?:\/|$)/);
      return match ? normalizeQuestionId(match[1]) : '';
    } catch {
      return '';
    }
  }

  function normalizeImportedSettings(payload) {
    const source = isPlainObject(payload) ? payload : {};
    const importedSites = isPlainObject(source.sites) ? source.sites : {};
    const sites = {};

    for (const [rawOrigin, config] of Object.entries(importedSites)) {
      const origin = getSupportedOrigin(rawOrigin);
      if (origin && origin === rawOrigin) {
        sites[origin] = normalizeSiteConfig(config);
      }
    }

    return { version: DEFAULT_SETTINGS.version, sites };
  }

  root.ATSUConfig = Object.freeze({
    COLOR_PROFILES,
    DEFAULT_SITE_CONFIG,
    DEFAULT_SETTINGS,
    clone,
    getQuestionIdFromUrl,
    getSupportedOrigin,
    isPlainObject,
    isSupportedOrigin,
    normalizeImportedSettings,
    normalizeQuestionId,
    normalizeSiteConfig
  });
})(globalThis);
