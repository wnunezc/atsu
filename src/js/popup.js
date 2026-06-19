/* ATSU 1.0.0 - compact popup */
(() => {
  'use strict';

  const { COLOR_PROFILES, DEFAULT_SITE_CONFIG, normalizeSiteConfig } = ATSUConfig;

  const state = { supported: false, origin: '', url: '', config: normalizeSiteConfig() };
  const elements = {};

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: false, error: 'Empty response.' });
        });
      } catch (error) {
        resolve({ ok: false, error: error.message || String(error) });
      }
    });
  }

  function sendTabMessage(message) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs.length > 0 ? tabs[0] : null;
        if (!tab || !tab.id) {
          resolve({ ok: false, error: 'No active tab.' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { ok: true });
        });
      });
    });
  }

  function collectElements() {
    ['site-origin','status-pill','unsupported','settings','enabled','newPosts','comments','languageDetection','expectedLanguage','mreDetection','codePostDetection','colors','debug','smartTemplates','commentMaxSuggestions','colorProfile','colorNormal','colorVisited','colorClosed','reset','resetAll','save','status','exportSettings','importSettings','importFile']
      .forEach((id) => { elements[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });
  }

  function getSelectedProfileColors() {
    const profile = elements.colorProfile.value;
    if (profile !== 'custom' && COLOR_PROFILES[profile]) {
      return COLOR_PROFILES[profile];
    }
    return {
      normal: elements.colorNormal.value,
      visited: elements.colorVisited.value,
      closed: elements.colorClosed.value
    };
  }

  function render() {
    elements.siteOrigin.textContent = state.origin || state.url || 'Unsupported tab';
    elements.unsupported.classList.toggle('hidden', state.supported);
    elements.settings.classList.toggle('hidden', !state.supported);

    const config = normalizeSiteConfig(state.config);
    elements.enabled.checked = config.enabled;
    elements.newPosts.checked = config.newPosts;
    elements.comments.checked = config.comments;
    elements.languageDetection.checked = config.languageDetection;
    elements.expectedLanguage.value = config.expectedLanguage;
    elements.mreDetection.checked = config.mreDetection;
    elements.codePostDetection.checked = config.codePostDetection;
    elements.colors.checked = config.colors;
    elements.debug.checked = config.debug;
    elements.smartTemplates.checked = config.smartTemplates;
    elements.commentMaxSuggestions.value = String(config.commentMaxSuggestions);
    elements.colorProfile.value = config.colorProfile;
    elements.colorNormal.value = config.rgbColors.normal;
    elements.colorVisited.value = config.rgbColors.visited;
    elements.colorClosed.value = config.rgbColors.closed;

    elements.statusPill.textContent = !state.supported ? 'Off' : (config.enabled ? 'Enabled' : 'Ready');
    elements.statusPill.className = `pill ${config.enabled ? 'ok' : 'off'}`;
    renderEnabledState();
  }

  function renderEnabledState() {
    const enabled = elements.enabled.checked;
    document.querySelectorAll('#settings .tab-panel').forEach((panel) => {
      panel.classList.toggle('disabled-subtree', !enabled && !panel.matches('[data-panel="general"]'));
    });

    const profile = elements.colorProfile.value;
    const manual = profile === 'custom';
    const colorEnabled = elements.colors.checked && profile !== 'none';
    elements.colorNormal.disabled = !enabled || !colorEnabled || !manual;
    elements.colorVisited.disabled = !enabled || !colorEnabled || !manual;
    elements.colorClosed.disabled = !enabled || !colorEnabled || !manual;
    elements.colors.checked = profile === 'none' ? false : elements.colors.checked;
  }

  function applyProfileToForm() {
    const profile = elements.colorProfile.value;
    if (profile !== 'custom' && COLOR_PROFILES[profile]) {
      elements.colorNormal.value = COLOR_PROFILES[profile].normal;
      elements.colorVisited.value = COLOR_PROFILES[profile].visited;
      elements.colorClosed.value = COLOR_PROFILES[profile].closed;
    }
    if (profile === 'none') {
      elements.colors.checked = false;
    } else if (!elements.colors.checked) {
      elements.colors.checked = true;
    }
    renderEnabledState();
    previewColors();
  }

  function getConfigFromForm() {
    const profile = elements.colorProfile.value;
    return normalizeSiteConfig({
      enabled: elements.enabled.checked,
      newPosts: elements.newPosts.checked,
      comments: elements.comments.checked,
      languageDetection: elements.languageDetection.checked,
      expectedLanguage: elements.expectedLanguage.value,
      mreDetection: elements.mreDetection.checked,
      codePostDetection: elements.codePostDetection.checked,
      colors: profile === 'none' ? false : elements.colors.checked,
      debug: elements.debug.checked,
      smartTemplates: elements.smartTemplates.checked,
      commentMaxSuggestions: Number(elements.commentMaxSuggestions.value),
      colorProfile: profile,
      rgbColors: getSelectedProfileColors()
    });
  }

  async function previewColors() {
    if (!state.supported) return;
    const config = getConfigFromForm();
    await sendTabMessage({ action: 'ATSU_PREVIEW_COLORS', rgbColors: config.rgbColors, colors: config.colors });
  }

  async function save() {
    const config = getConfigFromForm();
    elements.save.disabled = true;
    elements.status.textContent = 'Saving configuration…';
    const response = await sendMessage({ action: 'ATSU_SAVE_SITE_CONFIG', origin: state.origin, url: state.url, config });
    if (!response || !response.ok) {
      elements.status.textContent = response && response.error ? response.error : 'Could not save ATSU settings.';
      elements.save.disabled = false;
      return;
    }
    state.config = normalizeSiteConfig(response.config);
    elements.status.textContent = 'Saved. Reloading tab…';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs.length > 0 ? tabs[0] : null;
      if (tab && tab.id) chrome.tabs.reload(tab.id);
      window.setTimeout(() => window.close(), 350);
    });
  }

  function reset() {
    state.config = normalizeSiteConfig(DEFAULT_SITE_CONFIG);
    render();
    previewColors();
  }

  async function exportSettings() {
    const response = await sendMessage({ action: 'ATSU_EXPORT_SETTINGS' });
    if (!response || !response.ok) {
      elements.status.textContent = response && response.error ? response.error : 'Could not export settings.';
      return;
    }
    const blob = new Blob([JSON.stringify(response.settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atsu-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    elements.status.textContent = 'Settings exported.';
  }

  async function importSettingsFromFile(file) {
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      const response = await sendMessage({ action: 'ATSU_IMPORT_SETTINGS', settings });
      if (!response || !response.ok) throw new Error(response && response.error ? response.error : 'Import failed.');
      elements.status.textContent = 'Settings imported. Reload the page to apply all changes.';
      const active = await sendMessage({ action: 'ATSU_GET_ACTIVE_STATE' });
      if (active && active.ok) {
        state.config = normalizeSiteConfig(active.config);
        render();
      }
    } catch (error) {
      elements.status.textContent = `Import failed: ${error.message || error}`;
    } finally {
      elements.importFile.value = '';
    }
  }

  async function resetAll() {
    if (!confirm('Reset all ATSU settings for every site?')) return;
    const response = await sendMessage({ action: 'ATSU_RESET_ALL_SETTINGS' });
    if (!response || !response.ok) {
      elements.status.textContent = response && response.error ? response.error : 'Could not reset settings.';
      return;
    }
    state.config = normalizeSiteConfig(DEFAULT_SITE_CONFIG);
    render();
    elements.status.textContent = 'All settings reset.';
  }

  function bindTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((node) => node.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((node) => node.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      });
    });
  }

  function bindEvents() {
    bindTabs();
    elements.enabled.addEventListener('change', renderEnabledState);
    elements.colors.addEventListener('change', () => { renderEnabledState(); previewColors(); });
    elements.colorProfile.addEventListener('change', applyProfileToForm);
    [elements.colorNormal, elements.colorVisited, elements.colorClosed].forEach((input) => input.addEventListener('input', previewColors));
    elements.save.addEventListener('click', save);
    elements.reset.addEventListener('click', reset);
    elements.exportSettings.addEventListener('click', exportSettings);
    elements.importSettings.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', () => {
      const file = elements.importFile.files && elements.importFile.files[0];
      if (file) importSettingsFromFile(file);
    });
    elements.resetAll.addEventListener('click', resetAll);
    window.addEventListener('blur', () => sendTabMessage({ action: 'ATSU_CLEAR_PREVIEW' }));
  }

  async function boot() {
    collectElements();
    bindEvents();
    const response = await sendMessage({ action: 'ATSU_GET_ACTIVE_STATE' });
    if (!response || !response.ok) {
      elements.status.textContent = response && response.error ? response.error : 'Could not read current tab.';
      render();
      return;
    }
    state.supported = Boolean(response.supported);
    state.origin = response.origin || '';
    state.url = response.url || '';
    state.config = normalizeSiteConfig(response.config);
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
