import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, test } from 'vitest';

const configSource = readFileSync(new URL('../../src/js/shared/config.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('../../src/js/content.js', import.meta.url), 'utf8');

const doms = [];

function waitFor(predicate, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (predicate()) {
        resolve();
      } else if (Date.now() - started >= timeout) {
        reject(new Error('Timed out waiting for DOM state.'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

function createContentDom(configOverrides = {}) {
  const dom = new JSDOM(`<!doctype html>
    <html>
      <body>
        <main id="mainbar">
          <article id="question" class="question" data-questionid="123">
            <div class="js-post-body">I need help with a JavaScript problem.</div>
            <form id="add-comment-123"><textarea class="js-comment-text-input"></textarea></form>
          </article>
        </main>
        <aside id="sidebar"></aside>
      </body>
    </html>`, {
    url: 'https://stackoverflow.com/questions/123/example',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  doms.push(dom);

  const config = {
    enabled: true,
    comments: true,
    newPosts: true,
    languageDetection: true,
    mreDetection: true,
    codePostDetection: true,
    colors: true,
    debug: false,
    smartTemplates: true,
    expectedLanguage: 'auto',
    commentMaxSuggestions: 2,
    colorProfile: 'soft',
    rgbColors: {
      normal: '#2368a2',
      visited: '#5f4b8b',
      closed: '#6a737c'
    },
    ...configOverrides
  };

  dom.window.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        if (message.action === 'ATSU_GET_CONTENT_STATE') {
          callback({
            ok: true,
            supported: true,
            origin: 'https://stackoverflow.com',
            config,
            visitedQuestionIds: []
          });
          return;
        }
        callback({ ok: true, visitedQuestionIds: ['123'] });
      },
      onMessage: { addListener() {} }
    }
  };

  dom.window.eval(configSource);
  dom.window.eval(contentSource);
  return dom;
}

afterEach(() => {
  while (doms.length > 0) {
    doms.pop().window.close();
  }
});

describe('content script DOM behavior', () => {
  test('does not add comment controls when comments are disabled', async () => {
    const dom = createContentDom({ comments: false });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(dom.window.document.querySelector('.atsu-v2-comment-button')).toBeNull();
  });

  test('adds one assistant button to existing and dynamically added comment boxes', async () => {
    const dom = createContentDom();
    const { document } = dom.window;
    await waitFor(() => document.querySelectorAll('.atsu-v2-comment-button').length === 1);

    const answer = document.createElement('article');
    answer.className = 'answer';
    answer.dataset.answerid = '456';
    answer.innerHTML = '<div class="js-post-body">An answer.</div><form id="add-comment-456"><textarea class="js-comment-text-input"></textarea></form>';
    document.querySelector('#mainbar').appendChild(answer);

    await waitFor(() => document.querySelectorAll('.atsu-v2-comment-button').length === 2);
    answer.appendChild(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(document.querySelectorAll('.atsu-v2-comment-button')).toHaveLength(2);
  });

  test('closes the comment dialog with Escape and restores focus', async () => {
    const dom = createContentDom();
    const { document, KeyboardEvent } = dom.window;
    await waitFor(() => document.querySelector('.atsu-v2-comment-button'));

    const trigger = document.querySelector('.atsu-v2-comment-button');
    trigger.focus();
    trigger.click();

    await waitFor(() => document.querySelector('#atsu-v2-modal'));
    expect(document.querySelector('#atsu-v2-modal [role="dialog"]')).not.toBeNull();
    expect(document.activeElement).not.toBe(trigger);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('#atsu-v2-modal')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
