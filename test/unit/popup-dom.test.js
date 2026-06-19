import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, test } from 'vitest';

const html = readFileSync(new URL('../../src/html/popup.html', import.meta.url), 'utf8');
const configSource = readFileSync(new URL('../../src/js/shared/config.js', import.meta.url), 'utf8');
const popupSource = readFileSync(new URL('../../src/js/popup.js', import.meta.url), 'utf8');
const doms = [];

function waitFor(predicate, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (predicate()) {
        resolve();
      } else if (Date.now() - started >= timeout) {
        reject(new Error('Timed out waiting for popup state.'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

function createPopupDom() {
  const dom = new JSDOM(html, {
    url: 'chrome-extension://atsu/src/html/popup.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  doms.push(dom);
  dom.window.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        callback({
          ok: true,
          supported: true,
          origin: 'https://stackoverflow.com',
          url: 'https://stackoverflow.com/questions',
          config: { enabled: true }
        });
      }
    },
    tabs: {
      query(_query, callback) {
        callback([{ id: 1 }]);
      },
      sendMessage(_id, _message, callback) {
        callback({ ok: true });
      },
      reload() {}
    }
  };
  dom.window.confirm = () => true;
  dom.window.eval(configSource);
  dom.window.eval(popupSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', { bubbles: true }));
  return dom;
}

afterEach(() => {
  while (doms.length > 0) {
    doms.pop().window.close();
  }
});

describe('popup tabs', () => {
  test('support ArrowRight and ArrowLeft keyboard navigation', async () => {
    const dom = createPopupDom();
    const { document, KeyboardEvent } = dom.window;
    await waitFor(() => !document.querySelector('#settings').classList.contains('hidden'));

    const tabs = [...document.querySelectorAll('.tab')];
    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(tabs[1].classList.contains('active')).toBe(true);
    expect(document.activeElement).toBe(tabs[1]);

    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabs[0].classList.contains('active')).toBe(true);
    expect(document.activeElement).toBe(tabs[0]);
  });
});
