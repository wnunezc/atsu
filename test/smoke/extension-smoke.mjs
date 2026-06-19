import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '../..');
const profilePath = join(root, '.tmp', 'chrome-profile-smoke');
const questionFixture = readFileSync(join(root, 'test', 'fixtures', 'question.html'), 'utf8');
const questionsFixture = readFileSync(join(root, 'test', 'fixtures', 'questions.html'), 'utf8');
const playwrightCache = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
const cachedChromium = existsSync(playwrightCache)
  ? readdirSync(playwrightCache)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort()
    .reverse()
    .map((entry) => join(playwrightCache, entry, 'chrome-win64', 'chrome.exe'))
    .find((candidate) => existsSync(candidate))
  : null;
const candidates = [
  process.env.CHROME_PATH,
  cachedChromium,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const executablePath = candidates.find((candidate) => existsSync(candidate));

if (!executablePath) {
  throw new Error('No compatible local Chromium executable was found.');
}

rmSync(profilePath, { recursive: true, force: true });

const context = await chromium.launchPersistentContext(profilePath, {
  executablePath,
  headless: true,
  args: [
    `--disable-extensions-except=${root}`,
    `--load-extension=${root}`,
    '--no-first-run',
    '--no-default-browser-check'
  ]
});

const errors = [];
context.on('weberror', (error) => errors.push(`Web error: ${error.error().message}`));

try {
  const worker = await Promise.race([
    context.waitForEvent('serviceworker', { timeout: 15000 }),
    new Promise((resolveWorker, reject) => {
      const started = Date.now();
      const poll = () => {
        const existing = context.serviceWorkers()[0];
        if (existing) {
          resolveWorker(existing);
        } else if (Date.now() - started > 15000) {
          reject(new Error('ATSU service worker did not start.'));
        } else {
          setTimeout(poll, 100);
        }
      };
      poll();
    })
  ]);

  const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
  if (manifest.name !== 'ATSU' || manifest.version !== '1.0.0' || manifest.manifest_version !== 3) {
    throw new Error(`Unexpected manifest metadata: ${JSON.stringify(manifest)}`);
  }

  const origin = 'https://stackoverflow.com';
  await worker.evaluate(async ({ origin }) => {
    await chrome.storage.local.set({
      atsu_v2_settings: {
        version: 3,
        sites: {
          [origin]: {
            enabled: true,
            comments: false,
            newPosts: true,
            colors: true,
            debug: true
          }
        }
      },
      atsu_v2_visited_questions: {
        version: 1,
        origins: {
          [origin]: ['200']
        }
      }
    });
  }, { origin });

  await context.route('https://stackoverflow.com/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === '/questions' ? questionsFixture : questionFixture;
    await route.fulfill({ status: 200, contentType: 'text/html', body });
  });

  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`Page error: ${error.message}`));
  await page.goto('https://stackoverflow.com/questions/123/fixture-question');
  await page.waitForSelector('#atsu-v2-panel');

  if (await page.locator('.atsu-v2-comment-button').count() !== 0) {
    throw new Error('Comment assistant was rendered while comments=false.');
  }

  await worker.evaluate(async ({ origin }) => {
    const result = await chrome.storage.local.get('atsu_v2_settings');
    result.atsu_v2_settings.sites[origin].comments = true;
    await chrome.storage.local.set(result);
  }, { origin });

  await page.reload();
  await page.waitForSelector('.atsu-v2-comment-button');
  if (!(await page.locator('html').evaluate((element) => element.classList.contains('atsu-v2-link-color')))) {
    throw new Error('Color highlighting was not enabled.');
  }
  if (await page.locator('#atsu-v2-diagnostic').count() !== 1) {
    throw new Error('Diagnostics panel was not rendered while debug=true.');
  }

  const listPage = await context.newPage();
  listPage.on('pageerror', (error) => errors.push(`List page error: ${error.message}`));
  await listPage.goto('https://stackoverflow.com/questions');
  await listPage.waitForSelector('.atsu-v2-badge-closed');
  if (await listPage.locator('[data-questionid="200"] .atsu-v2-badge-new').count() !== 0) {
    throw new Error('Visited question 200 received a NEW badge.');
  }
  if (await listPage.locator('[data-questionid="201"] .atsu-v2-badge-new').count() !== 1) {
    throw new Error('Unvisited question 201 did not receive a NEW badge.');
  }

  await listPage.locator('#questions').evaluate((list) => {
    const article = document.createElement('article');
    article.className = 's-post-summary';
    article.dataset.questionid = '202';
    article.innerHTML = '<h3><a class="s-link" href="/questions/202/dynamic-question">Dynamic question</a></h3>';
    list.appendChild(article);
  });
  await listPage.waitForSelector('[data-questionid="202"] .atsu-v2-badge-new');
  await listPage.waitForSelector('#atsu-v2-toast');

  const workerUrl = new URL(worker.url());
  const extensionBase = `${workerUrl.protocol}//${workerUrl.host}`;
  const popup = await context.newPage();
  popup.on('pageerror', (error) => errors.push(`Popup error: ${error.message}`));
  await popup.goto(`${extensionBase}/src/html/popup.html`);
  await popup.waitForSelector('h1');

  if ((await popup.locator('h1').textContent())?.trim() !== 'ATSU 1.0.0') {
    throw new Error('Popup did not display ATSU 1.0.0.');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  console.log(`Smoke test passed with ${executablePath}.`);
  console.log(`Loaded extension worker: ${worker.url()}`);
} finally {
  await context.close();
  rmSync(profilePath, { recursive: true, force: true });
}
