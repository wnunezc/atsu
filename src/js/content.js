/*
 * ATSU 1.0.0 - Content script
 * Normalized rescue build for Stack Overflow / Stack Exchange pages.
 *
 * This file intentionally avoids fragile deep DOM selectors. Every selector
 * is centralized, has fallback options, and the extension only inserts its own
 * nodes instead of replacing native Stack Exchange UI blocks.
 */

(() => {
  'use strict';

  const { getQuestionIdFromUrl, normalizeQuestionId, normalizeSiteConfig } = ATSUConfig;

  const ATSU = {
    ids: {
      style: 'atsu-v2-style',
      panel: 'atsu-v2-panel',
      modal: 'atsu-v2-modal',
      toast: 'atsu-v2-toast',
      diagnostic: 'atsu-v2-diagnostic'
    },
    state: {
      config: null,
      origin: window.location.origin,
      suggestions: [],
      observer: null,
      pendingRoots: new Set(),
      refreshScheduled: false,
      initialQuestionIds: new Set(),
      visitedQuestionIds: new Set(),
      newPostCount: 0
    }
  };

  const SELECTORS = {
    sidebars: ['#sidebar', '.right-sidebar', 'aside[role="complementary"]'],
    mainbar: ['#mainbar', '.mainbar', 'main'],
    questionRoots: ['#question', '.question', '[data-questionid]'],
    answerRoots: ['.answer', '[id^="answer-"]', '[data-answerid]'],
    postBodies: ['#question .js-post-body', '.question .js-post-body', '.answer .js-post-body', '.js-post-body.s-prose', '.js-post-body', '.s-prose'],
    questionLists: ['#questions', '#question-mini-list', '.js-post-summaries', '.question-list'],
    questionCards: ['.s-post-summary', '.question-summary', '.question-mini-list .question-summary', '[id^="question-summary-"]'],
    questionLinks: ['a.s-link[href^="/questions/"]', 'a.question-hyperlink[href^="/questions/"]', 'a[href^="/questions/"]'],
    commentTextareas: ['textarea.js-comment-text-input', 'textarea[name="comment"]', '[id^="add-comment-"] textarea', 'form textarea'],
    commentLinks: ['a.js-add-link.comments-link', 'a.comments-link', 'a[id^="add-comment-"]'],
    newContributorTextZones: ['#question .post-signature', '#question .user-info', '#question', '.question']
  };

  const STRINGS = {
    EN: {
      title: 'ATSU suggestions',
      empty: 'No relevant ATSU warnings were detected for this post.',
      localOnly: 'Local heuristic review. Always verify the post context before commenting.',
      commentAssistant: 'ATSU comment',
      modalTitle: 'Build a helpful comment',
      insert: 'Insert into comment box',
      close: 'Close',
      newPost: 'New question detected',
      newBadge: 'NEW',
      closedBadge: 'CLOSED',
      qa: {
        content1: 'The post seems to lack a clear explanation. Consider asking the author to explain the exact problem, expected result, and what they already tried.',
        content2: 'The post has very little descriptive text. It may be hard to answer without more context.',
        post1: 'A minimal reproducible example appears to be missing. You may request the smallest complete example that reproduces the issue.',
        post2: 'The post appears to contain a large amount of code. It may need to be reduced to the relevant part only.',
        spam: 'This post has several links and little context. Review carefully before interacting.',
        noformatcode: 'The post may contain raw code that was not formatted as code.',
        onlyimg: 'The post includes images but little searchable text. It is usually better to ask for text/code instead of screenshots.',
        notlang1: 'The post may not be written in the expected language for this site.',
        notlang2: 'The post may contain mixed language content that could make it harder to answer.',
        newuser: 'The author appears to be a new contributor. Use a patient, welcoming tone and guide them toward editing the post.',
        broad: 'The question may be too broad. Consider asking the author to narrow it to one specific problem.',
        effort: 'The question may need more evidence of what was tried and where the author is stuck.',
        metaSteps: 'This Meta post may need clearer steps to reproduce the behavior or issue.',
        metaExpected: 'This Meta post may need a clearer expected result and actual result.',
        metaContext: 'This Meta post may need more context about the page, feature, browser, or workflow involved.'
      },
      comments: {
        intro: 'Hi{author}. Welcome to {site}.',
        context: 'I noticed the question is tagged {tagText}{titleText}.',
        explain: 'Please edit the question and add a clearer explanation of the problem, the expected result, what actually happened, and what you already tried. [ask]',
        mre: 'Please include a minimal reproducible example so others can reproduce the issue and help you more easily. [mre]',
        format: 'Please format the relevant code as text using code blocks. This makes the question easier to read and answer.',
        image: 'Please avoid posting code, errors, or data only as an image. Add the relevant code, error message, or data as text.',
        language: 'This site expects questions in English. Please translate the post so the community can understand and answer it.',
        answerIntro: 'Hi{author}.',
        answerContext: 'I am commenting on your answer.',
        answerExplain: 'This answer would be more useful if you add a short explanation of how the solution works and why it solves the problem.',
        answerCode: 'Please add a short explanation around the code so readers can understand the important part of the solution.',
        answerFormat: 'Please format the relevant code as text using code blocks. This makes the answer easier to read.',
        answerLinkOnly: 'Please include the essential details directly in the answer. Links can break or change over time.',
        answerNotAnswer: 'This seems to be a follow-up question or a “same problem” note. Please post it as a new question with the necessary details.',
        metaIntro: 'Hi{author}. Welcome to {site}.',
        metaSteps: 'Please add the exact steps needed to reproduce the behavior, including where it happens in the interface.',
        metaExpected: 'Please clarify what you expected to happen and what happened instead.',
        metaContext: 'Please add more context about the feature, page, browser, or workflow involved so others can verify it.',
        metaScope: 'Please narrow this to one specific support, bug, or feature-request point.',
        thanks: 'Thanks!'
      }
    },
    ES: {
      title: 'Sugerencias ATSU',
      empty: 'No se detectaron advertencias relevantes de ATSU para esta publicación.',
      localOnly: 'Revisión heurística local. Verifica siempre el contexto antes de comentar.',
      commentAssistant: 'Comentario ATSU',
      modalTitle: 'Crear un comentario útil',
      insert: 'Insertar en el comentario',
      close: 'Cerrar',
      newPost: 'Nueva pregunta detectada',
      newBadge: 'NUEVO',
      closedBadge: 'CERRADA',
      qa: {
        content1: 'La publicación parece carecer de una explicación clara. Puedes pedir que indique el problema exacto, el resultado esperado y lo que ya intentó.',
        content2: 'La publicación tiene muy poco texto descriptivo. Puede ser difícil responder sin más contexto.',
        post1: 'Parece faltar un ejemplo mínimo reproducible. Puedes solicitar el ejemplo más pequeño y completo que reproduzca el problema.',
        post2: 'La publicación parece contener demasiado código. Puede necesitar reducirse solo a la parte relevante.',
        spam: 'La publicación tiene varios enlaces y poco contexto. Revísala con cuidado antes de interactuar.',
        noformatcode: 'La publicación puede contener código sin formato de bloque de código.',
        onlyimg: 'La publicación incluye imágenes pero poco texto útil. Normalmente conviene pedir código o datos como texto, no capturas.',
        notlang1: 'La publicación puede no estar escrita en el idioma esperado para este sitio.',
        notlang2: 'La publicación puede mezclar idiomas de forma que dificulte responderla.',
        newuser: 'El autor parece ser un nuevo colaborador. Usa un tono paciente, amable y oriéntalo para mejorar la publicación.',
        broad: 'La pregunta puede ser demasiado amplia. Considera pedir que la reduzca a un problema específico.',
        effort: 'La pregunta puede necesitar más evidencia de lo que intentó y dónde quedó bloqueado.',
        metaSteps: 'Esta publicación de Meta puede necesitar pasos más claros para reproducir el comportamiento o problema.',
        metaExpected: 'Esta publicación de Meta puede necesitar aclarar mejor el resultado esperado y el resultado real.',
        metaContext: 'Esta publicación de Meta puede necesitar más contexto sobre la página, función, navegador o flujo involucrado.'
      },
      comments: {
        intro: 'Hola{author}. Gracias por publicar en {site}.',
        context: 'Vi que la pregunta usa la etiqueta {tagText}{titleText}.',
        explain: 'Edita la pregunta y agrega una explicación más clara del problema: qué esperabas que ocurriera, qué ocurrió realmente y qué has intentado. [ask]',
        mre: 'Incluye un ejemplo mínimo reproducible para que otros puedan reproducir el problema y ayudarte con mayor facilidad. [mre]',
        format: 'Por favor, formatea el código relevante como texto usando bloques de código. Así será más fácil leer y responder la pregunta.',
        image: 'Evita publicar código, errores o datos solo como imagen. Agrega el código, mensaje de error o datos relevantes como texto.',
        language: 'Este sitio espera preguntas en español. Traduce la publicación para que la comunidad pueda entenderla y responderla.',
        answerIntro: 'Hola{author}.',
        answerContext: 'Estoy comentando tu respuesta.',
        answerExplain: 'Tu respuesta sería más útil si agregas una breve explicación de cómo funciona la solución y por qué resuelve el problema.',
        answerCode: 'Agrega una breve explicación junto al código para que otros usuarios entiendan la parte importante de la solución.',
        answerFormat: 'Por favor, formatea el código relevante como texto usando bloques de código. Así será más fácil leer la respuesta.',
        answerLinkOnly: 'Incluye los detalles esenciales directamente en la respuesta. Los enlaces pueden cambiar o dejar de funcionar con el tiempo.',
        answerNotAnswer: 'Esto parece una nueva duda o un comentario de “tengo el mismo problema”. Publícalo como una nueva pregunta con los detalles necesarios.',
        metaIntro: 'Hola{author}. Gracias por publicar en {site}.',
        metaSteps: 'Agrega los pasos exactos para reproducir el comportamiento, incluyendo dónde ocurre dentro de la interfaz.',
        metaExpected: 'Aclara qué esperabas que ocurriera y qué ocurrió realmente.',
        metaContext: 'Agrega más contexto sobre la función, página, navegador o flujo involucrado para que otros puedan verificarlo.',
        metaScope: 'Reduce la publicación a un punto específico de soporte, error o solicitud de mejora.',
        thanks: '¡Gracias!'
      }
    }
  };

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

  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function queryAll(root, selectors) {
    const elements = [];

    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => {
        if (!elements.includes(element)) {
          elements.push(element);
        }
      });
    });

    return elements;
  }

  function queryAllIncludingRoot(root, selectors) {
    const elements = queryAll(root, selectors);
    if (root instanceof Element && selectors.some((selector) => root.matches(selector))) {
      elements.unshift(root);
    }
    return elements;
  }

  function getLanguage(config = ATSU.state.config) {
    if (config && config.expectedLanguage && config.expectedLanguage !== 'auto') {
      return config.expectedLanguage.toUpperCase();
    }

    const hostname = window.location.hostname.toLowerCase();

    if (hostname.startsWith('es.')) {
      return 'ES';
    }

    if (hostname.startsWith('pt.') || hostname.startsWith('ru.') || hostname.startsWith('ja.')) {
      return 'EN';
    }

    return 'EN';
  }

  function t() {
    return STRINGS[getLanguage()] || STRINGS.EN;
  }

  function escapeCssColor(value, fallback) {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
      return value;
    }

    return fallback;
  }

  function ensureStyles(config) {
    const colors = config.rgbColors || {};
    const normal = escapeCssColor(colors.normal, '#0077cc');
    const visited = escapeCssColor(colors.visited, '#5f4b8b');
    const closed = escapeCssColor(colors.closed, '#6a737c');
    let style = document.getElementById(ATSU.ids.style);

    if (!style) {
      style = document.createElement('style');
      style.id = ATSU.ids.style;
      document.documentElement.appendChild(style);
    }

    style.textContent = `
      :root {
        --atsu-normal: ${normal};
        --atsu-visited: ${visited};
        --atsu-closed: ${closed};
        --atsu-border: rgba(95, 75, 139, 0.28);
        --atsu-bg: #ffffff;
        --atsu-muted: #6a737c;
      }

      #atsu-v2-panel {
        border: 1px solid var(--atsu-border);
        border-radius: 8px;
        background: var(--atsu-bg);
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        margin: 0 0 16px 0;
        padding: 12px;
        font-size: 13px;
        line-height: 1.35;
      }

      #atsu-v2-panel h3 {
        font-size: 15px;
        margin: 0 0 8px 0;
      }

      #atsu-v2-panel ul {
        margin: 8px 0;
        padding-left: 18px;
      }

      #atsu-v2-panel li {
        margin-bottom: 7px;
      }

      #atsu-v2-panel .atsu-v2-footnote {
        color: var(--atsu-muted);
        font-size: 12px;
        margin-top: 8px;
      }

      #atsu-v2-diagnostic {
        border-top: 1px solid var(--atsu-border);
        margin-top: 10px;
        padding-top: 8px;
        font-size: 12px;
      }

      #atsu-v2-diagnostic code {
        background: #f1f2f3;
        border-radius: 3px;
        padding: 1px 3px;
      }

      #atsu-v2-diagnostic dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 4px 8px;
        margin: 6px 0 0 0;
      }

      #atsu-v2-diagnostic dt {
        color: var(--atsu-muted);
      }

      #atsu-v2-diagnostic dd {
        margin: 0;
      }

      .atsu-v2-link-color #questions a[href^="/questions/"],
      .atsu-v2-link-color #question-mini-list a[href^="/questions/"],
      .atsu-v2-link-color .js-post-summaries a[href^="/questions/"],
      .atsu-v2-link-color a.question-hyperlink[href^="/questions/"],
      .atsu-v2-link-color .s-post-summary a.s-link[href^="/questions/"] {
        color: var(--atsu-normal) !important;
      }

      .atsu-v2-link-color #questions a[href^="/questions/"]:visited,
      .atsu-v2-link-color #question-mini-list a[href^="/questions/"]:visited,
      .atsu-v2-link-color .js-post-summaries a[href^="/questions/"]:visited,
      .atsu-v2-link-color a.question-hyperlink[href^="/questions/"]:visited,
      .atsu-v2-link-color .s-post-summary a.s-link[href^="/questions/"]:visited {
        color: var(--atsu-visited) !important;
      }

      .atsu-v2-link-color .s-post-summary--closed a[href^="/questions/"],
      .atsu-v2-link-color .question-summary.closed a[href^="/questions/"],
      .atsu-v2-link-color [class*="closed"] a[href^="/questions/"] {
        color: var(--atsu-closed) !important;
      }

      .atsu-v2-comment-button {
        margin: 6px 0 0 6px;
        border: 1px solid var(--atsu-border);
        border-radius: 4px;
        background: #f8f9f9;
        color: #3b4045;
        cursor: pointer;
        font-size: 12px;
        padding: 5px 8px;
      }

      .atsu-v2-comment-button:hover {
        background: #eff0f1;
      }

      #atsu-v2-modal {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #atsu-v2-modal .atsu-v2-dialog {
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
        max-width: 680px;
        width: min(680px, calc(100vw - 28px));
        max-height: calc(100vh - 36px);
        overflow: auto;
        padding: 16px;
      }

      #atsu-v2-modal h2 {
        font-size: 18px;
        margin: 0 0 12px 0;
      }

      #atsu-v2-modal label {
        display: block;
        margin: 8px 0;
      }

      #atsu-v2-modal textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 120px;
        margin-top: 12px;
      }

      #atsu-v2-modal .atsu-v2-counter {
        color: var(--atsu-muted);
        font-size: 12px;
        margin-top: 4px;
        text-align: right;
      }

      #atsu-v2-modal .atsu-v2-counter-warning {
        color: #b94a00;
        font-weight: 700;
      }

      #atsu-v2-modal .atsu-v2-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 12px;
      }

      #atsu-v2-modal button,
      #atsu-v2-toast button {
        cursor: pointer;
      }

      .atsu-v2-new-post {
        scroll-margin-top: 80px;
      }

      .atsu-v2-question-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        border-radius: 999px;
        padding: 2px 7px;
        margin-right: 6px;
        vertical-align: middle;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 1.4;
        white-space: nowrap;
      }

      .atsu-v2-badge-new {
        background: #f1b600;
        color: #111;
        border: 1px solid rgba(0, 0, 0, 0.12);
      }

      .atsu-v2-badge-closed {
        background: var(--atsu-closed);
        color: #fff;
        border: 1px solid rgba(0, 0, 0, 0.16);
      }

      .atsu-v2-badge-new::before {
        content: "★";
        font-size: 10px;
      }

      .atsu-v2-badge-closed::before {
        content: "×";
        font-size: 11px;
        font-weight: 900;
      }

      #atsu-v2-toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483646;
        background: #2f3337;
        color: #fff;
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 13px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
      }
    `;
  }

  function applyLinkHighlighting(config) {
    document.documentElement.classList.toggle('atsu-v2-link-color', Boolean(config && config.colors));
  }

  function getSiteMode() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.startsWith('meta.') || hostname.includes('.meta.') || /(^|\.)meta\.mathoverflow\.net$/i.test(hostname)) {
      return 'meta';
    }
    return 'technical';
  }

  function isMetaSite() {
    return getSiteMode() === 'meta';
  }

  function isQuestionPage() {
    return /^\/questions\/\d+/.test(window.location.pathname);
  }


  function isQuestionListPage() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';

    if (path === '/questions' || path === '/unanswered' || path === '/search') {
      return true;
    }

    // Stack Exchange home pages can also show a question feed without ending in /questions.
    // Do not rely on the URL alone; require a real question list/card to avoid marking
    // navigation links or unrelated sidebar links.
    if (path === '/') {
      return Boolean(queryFirst(document, SELECTORS.questionLists))
        && queryAll(document, SELECTORS.questionCards).length > 0;
    }

    return false;
  }

  function normalizeSpaces(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function truncateText(value, maxLength) {
    const text = normalizeSpaces(value);

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function getSiteName() {
    const hostname = window.location.hostname.toLowerCase();

    const knownSites = {
      'stackoverflow.com': 'Stack Overflow',
      'es.stackoverflow.com': 'Stack Overflow en español',
      'pt.stackoverflow.com': 'Stack Overflow em Português',
      'ru.stackoverflow.com': 'Stack Overflow на русском',
      'ja.stackoverflow.com': 'スタック・オーバーフロー',
      'meta.stackoverflow.com': 'Meta Stack Overflow',
      'es.meta.stackoverflow.com': 'Meta Stack Overflow en español',
      'serverfault.com': 'Server Fault',
      'superuser.com': 'Super User',
      'askubuntu.com': 'Ask Ubuntu',
      'stackapps.com': 'Stack Apps',
      'mathoverflow.net': 'MathOverflow',
      'meta.mathoverflow.net': 'MathOverflow Meta'
    };

    if (knownSites[hostname]) {
      return knownSites[hostname];
    }

    if (hostname.endsWith('.stackexchange.com')) {
      const firstPart = hostname.replace(/\.stackexchange\.com$/, '').replace(/^meta\./, 'Meta ');
      return firstPart
        .split(/[.-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }

    const logo = document.querySelector('.-logo .-img, .site-title, [aria-label="Stack Exchange"]');
    const logoText = normalizeSpaces(logo ? logo.textContent : '');

    return logoText || window.location.hostname;
  }

  function getQuestionTitle() {
    const titleElement = queryFirst(document, [
      '#question-header h1 a.question-hyperlink',
      '#question-header h1 a',
      'h1 a.question-hyperlink',
      'h1[itemprop="name"] a',
      'h1'
    ]);

    if (titleElement) {
      return truncateText(titleElement.textContent, 90);
    }

    const documentTitle = normalizeSpaces(document.title)
      .replace(/\s*-\s*Stack Overflow en español\s*$/i, '')
      .replace(/\s*-\s*Stack Overflow\s*$/i, '')
      .replace(/\s*-\s*Stack Exchange\s*$/i, '');

    return truncateText(documentTitle, 90);
  }

  function getFirstQuestionTag() {
    const questionRoot = queryFirst(document, SELECTORS.questionRoots) || document;
    const tag = queryFirst(questionRoot, [
      '.js-post-tag-list .post-tag',
      '.post-taglist .post-tag',
      'a.post-tag[href*="/questions/tagged/"]',
      'a[href*="/questions/tagged/"]'
    ]);

    return truncateText(tag ? tag.textContent : '', 35);
  }

  function getPostAuthorName(postRoot) {
    const root = postRoot || queryFirst(document, SELECTORS.questionRoots) || document;
    const authorElement = queryFirst(root, [
      '.post-signature.owner .user-details a',
      '.post-signature .user-details a',
      '.user-info .user-details a',
      '.user-details a'
    ]);

    const name = normalizeSpaces(authorElement ? authorElement.textContent : '');

    if (!name || /^user\d+$/i.test(name)) {
      return '';
    }

    return truncateText(name, 35);
  }

  function getQuestionAuthorName() {
    return getPostAuthorName(queryFirst(document, SELECTORS.questionRoots));
  }

  function formatAuthorPlaceholder(context) {
    const author = context && context.author ? context.author : getQuestionAuthorName();
    return author ? `, ${author}` : '';
  }

  function extractPostIdFromCommentTarget(textarea) {
    const candidates = [];
    let current = textarea;

    while (current && current !== document.body && candidates.length < 12) {
      if (current.id) {
        candidates.push(current.id);
      }

      if (current.getAttribute) {
        const action = current.getAttribute('action');
        const name = current.getAttribute('name');

        if (action) {
          candidates.push(action);
        }

        if (name) {
          candidates.push(name);
        }
      }

      current = current.parentElement;
    }

    for (const value of candidates) {
      const match = String(value).match(/(?:add-comment|comments|comment|posts?|answers?)[^0-9]*(\d+)/i) || String(value).match(/\b(\d{2,})\b/);

      if (match) {
        return match[1];
      }
    }

    return '';
  }

  function findPostRootById(postId) {
    if (!postId) {
      return null;
    }

    return document.getElementById(`answer-${postId}`)
      || document.querySelector(`[data-answerid="${postId}"]`)
      || document.querySelector(`#question[data-questionid="${postId}"]`)
      || document.querySelector(`.question[data-questionid="${postId}"]`)
      || document.querySelector(`[data-questionid="${postId}"]`);
  }

  function findPostRootFromTextarea(textarea) {
    const postId = extractPostIdFromCommentTarget(textarea);
    const rootById = findPostRootById(postId);

    if (rootById) {
      return rootById;
    }

    return textarea.closest('.answer, #question, .question, [data-answerid], [data-questionid]')
      || queryFirst(document, SELECTORS.questionRoots);
  }

  function getPostType(postRoot) {
    if (!postRoot) {
      return 'question';
    }

    if (postRoot.matches('.answer, [data-answerid], [id^="answer-"]')) {
      return 'answer';
    }

    return 'question';
  }

  function getPostBodyFromRoot(postRoot) {
    if (!postRoot) {
      return queryFirst(document, SELECTORS.postBodies);
    }

    if (postRoot.matches('.js-post-body, .s-prose')) {
      return postRoot;
    }

    return queryFirst(postRoot, ['.js-post-body.s-prose', '.js-post-body', '.s-prose']);
  }

  function formatTagForComment(tag) {
    const cleanTag = normalizeSpaces(tag).replace(/\s+/g, '-');

    if (!cleanTag) {
      return '';
    }

    return `[tag:${cleanTag}]`;
  }

  function buildQuestionContext() {
    const strings = t();
    const tag = getFirstQuestionTag();
    const title = getQuestionTitle();
    const tagText = formatTagForComment(tag);
    const isSpanish = getLanguage() === 'ES';
    const connector = isSpanish ? ' y ' : ' and ';
    const titleText = title ? `${tagText ? connector : ''}${isSpanish ? 'trata sobre' : 'is about'} “${title}”` : '';

    if (!tagText && !titleText) {
      return '';
    }

    return strings.comments.context
      .replace('{tagText}', tagText || (isSpanish ? 'principal' : 'the main tag'))
      .replace('{titleText}', titleText);
  }

  function estimateLanguage(text) {
    const normalized = ` ${text.toLowerCase()} `;
    const spanishTokens = [' que ', ' para ', ' por ', ' con ', ' una ', ' este ', ' esta ', ' error ', ' gracias ', ' necesito ', ' problema ', ' código ', ' funcion ', ' función ', ' datos ', ' cuando ', ' porque '];
    const englishTokens = [' the ', ' and ', ' for ', ' with ', ' this ', ' that ', ' error ', ' thanks ', ' need ', ' problem ', ' code ', ' function ', ' data ', ' when ', ' because '];

    const spanishScore = spanishTokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
    const englishScore = englishTokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);

    if (spanishScore >= englishScore + 2) {
      return 'ES';
    }

    if (englishScore >= spanishScore + 2) {
      return 'EN';
    }

    return 'UNKNOWN';
  }

  function countRawCodeLines(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (line.length < 6) {
          return false;
        }

        return /(;|\{|\}|=>|function\s|class\s|SELECT\s|INSERT\s|UPDATE\s|console\.|var\s|let\s|const\s|public\s|private\s|<\/?[a-z][^>]*>)/i.test(line);
      })
      .length;
  }


  function analyzeTargetPost(postRoot, postType, config) {
    const strings = t();
    const suggestions = [];
    const body = getPostBodyFromRoot(postRoot);
    const metaSite = isMetaSite();

    if (!body) {
      return suggestions;
    }

    const text = body.textContent.replace(/\s+/g, ' ').trim();
    const rawText = body.textContent || '';
    const codeBlocks = Array.from(body.querySelectorAll('pre, code'));
    const codeTextLength = codeBlocks.reduce((total, node) => total + node.textContent.trim().length, 0);
    const links = body.querySelectorAll('a[href]').length;
    const images = body.querySelectorAll('img').length;
    const rawCodeLines = countRawCodeLines(rawText);
    const expectedLanguage = getLanguage(config);
    const detectedLanguage = estimateLanguage(text);

    function add(key, message, priority = 50) {
      suggestions.push({ key, message, priority });
    }

    if (postType === 'answer') {
      if (/\b(tengo el mismo problema|me pasa lo mismo|same problem|i have the same problem|me too|igual me pasa)\b/i.test(text)) {
        add('answerNotAnswer', strings.comments.answerNotAnswer, 95);
      }

      if (links > 0 && text.length < 260 && codeBlocks.length === 0) {
        add('answerLinkOnly', strings.comments.answerLinkOnly, 88);
      }

      if (text.length > 0 && text.length < 180) {
        add('answerExplain', strings.comments.answerExplain, 80);
      }

      if (config.codePostDetection && codeTextLength > 450 && codeTextLength > text.length * 0.45) {
        add('answerCode', strings.comments.answerCode, 78);
      }

      if (codeBlocks.length === 0 && rawCodeLines >= 3) {
        add('answerFormat', strings.comments.answerFormat, 74);
      }

      if (images > 0 && text.length < 260) {
        add('image', strings.comments.image, 70);
      }

      if (config.languageDetection && detectedLanguage !== 'UNKNOWN' && detectedLanguage !== expectedLanguage) {
        add('language', strings.comments.language, 65);
      }

      return suggestions.sort((a, b) => b.priority - a.priority);
    }

    if (metaSite && config.smartTemplates !== false) {
      if (/\b(bug|error|issue|problem|broken|not working|copy button|interface|ui|support|feature-request|discussion|status-)\b/i.test(`${text} ${getQuestionTitle()} ${getFirstQuestionTag()}`)) {
        add('metaSteps', strings.qa.metaSteps, 90);
        add('metaExpected', strings.qa.metaExpected, 86);
      }

      if (text.length > 0 && text.length < 450) {
        add('metaContext', strings.qa.metaContext, 80);
      }

      if (text.length > 900 && links >= 5) {
        add('metaScope', strings.comments.metaScope, 72);
      }
    } else {
      if (text.length > 0 && text.length < 220) {
        add('content1', strings.qa.content1, 86);
      }

      if (text.length > 0 && text.length < 120) {
        add('content2', strings.qa.content2, 82);
      }

      if (config.mreDetection && codeBlocks.length === 0) {
        add('post1', strings.qa.post1, 78);
      }

      if (config.codePostDetection && codeTextLength > 900 && codeTextLength > text.length * 0.55) {
        add('post2', strings.qa.post2, 74);
      }

      if (codeBlocks.length === 0 && rawCodeLines >= 3) {
        add('noformatcode', strings.qa.noformatcode, 76);
      }

      if (images > 0 && text.length < 260) {
        add('onlyimg', strings.qa.onlyimg, 84);
      }

      if (links >= 5 && text.length < 500) {
        add('spam', strings.qa.spam, 65);
      }

      if (/\b(homework|assignment|tarea|ejercicio|ayuda urgente|urgent help)\b/i.test(text) && !/\b(intent|tried|intento|intenté|probe|probé)\b/i.test(text)) {
        add('effort', strings.qa.effort, 62);
      }

      if (/\b(how do i|cómo hago|como hago|necesito hacer|help me|ayuda con)\b/i.test(text) && text.length > 800 && codeBlocks.length === 0) {
        add('broad', strings.qa.broad, 60);
      }
    }

    if (config.languageDetection && detectedLanguage !== 'UNKNOWN' && detectedLanguage !== expectedLanguage) {
      add('notlang1', strings.qa.notlang1, 68);
    }

    const contributorZones = postRoot ? queryAll(postRoot, SELECTORS.newContributorTextZones) : [];
    const isNewContributor = contributorZones.some((zone) => /new contributor|nuevo colaborador|nuevo contribuidor/i.test(zone.textContent));

    if (isNewContributor) {
      add('newuser', strings.qa.newuser, 58);
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  function getCommentContext(textarea) {
    const postRoot = findPostRootFromTextarea(textarea);
    const postType = getPostType(postRoot);
    const suggestions = postType === 'answer'
      ? analyzeTargetPost(postRoot, postType, ATSU.state.config)
      : (ATSU.state.suggestions.length > 0 ? ATSU.state.suggestions : analyzeTargetPost(postRoot, postType, ATSU.state.config));

    return {
      textarea,
      postRoot,
      postType,
      suggestions,
      author: getPostAuthorName(postRoot)
    };
  }

  function analyzePost(config) {
    const questionRoot = queryFirst(document, SELECTORS.questionRoots);

    if (!isQuestionPage() || !questionRoot) {
      ATSU.state.suggestions = [];
      return [];
    }

    const suggestions = analyzeTargetPost(questionRoot, 'question', config);
    ATSU.state.suggestions = suggestions;
    return suggestions;
  }

  function collectDiagnostics(suggestions) {
    const questionRoot = queryFirst(document, SELECTORS.questionRoots);
    return {
      site: getSiteName(),
      mode: getSiteMode(),
      page: isQuestionPage() ? 'question' : 'list/other',
      language: getLanguage(),
      questionDetected: Boolean(questionRoot),
      answersDetected: queryAll(document, SELECTORS.answerRoots).length,
      commentBoxes: queryAll(document, SELECTORS.commentTextareas).length,
      questionLinks: queryAll(document, SELECTORS.questionLinks).length,
      visibleBadges: document.querySelectorAll('.atsu-v2-question-badge').length,
      unvisitedBadges: document.querySelectorAll('.atsu-v2-badge-new').length,
      closedBadges: document.querySelectorAll('.atsu-v2-badge-closed').length,
      knownVisited: ATSU.state.visitedQuestionIds.size,
      suggestions: suggestions.length,
      newPosts: ATSU.state.newPostCount
    };
  }

  function renderDiagnostics(panel, suggestions) {
    let diagnostic = document.getElementById(ATSU.ids.diagnostic);

    if (!ATSU.state.config || !ATSU.state.config.debug) {
      if (diagnostic) {
        diagnostic.remove();
      }
      return;
    }

    if (!diagnostic) {
      diagnostic = document.createElement('div');
      diagnostic.id = ATSU.ids.diagnostic;
    }

    const data = collectDiagnostics(suggestions);
    diagnostic.textContent = '';

    const title = document.createElement('strong');
    title.textContent = 'ATSU diagnostics';
    diagnostic.appendChild(title);

    const list = document.createElement('dl');
    Object.entries(data).forEach(([key, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      const code = document.createElement('code');
      code.textContent = String(value);
      dd.appendChild(code);
      list.appendChild(dt);
      list.appendChild(dd);
    });
    diagnostic.appendChild(list);
    panel.appendChild(diagnostic);
  }

  function renderPanel(suggestions) {
    const strings = t();
    let panel = document.getElementById(ATSU.ids.panel);

    if (!isQuestionPage()) {
      if (panel) {
        panel.remove();
      }
      return;
    }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = ATSU.ids.panel;
      panel.setAttribute('aria-label', strings.title);
    }

    panel.textContent = '';

    const title = document.createElement('h3');
    title.textContent = strings.title;
    panel.appendChild(title);

    if (suggestions.length === 0) {
      const paragraph = document.createElement('p');
      paragraph.textContent = strings.empty;
      panel.appendChild(paragraph);
    } else {
      const list = document.createElement('ul');

      suggestions.forEach((suggestion) => {
        const item = document.createElement('li');
        item.textContent = suggestion.message;
        list.appendChild(item);
      });

      panel.appendChild(list);
    }

    const footnote = document.createElement('div');
    footnote.className = 'atsu-v2-footnote';
    footnote.textContent = strings.localOnly;
    panel.appendChild(footnote);

    renderDiagnostics(panel, suggestions);

    const sidebar = queryFirst(document, SELECTORS.sidebars);

    if (sidebar) {
      if (sidebar.firstElementChild !== panel) {
        sidebar.prepend(panel);
      }
      return;
    }

    const mainbar = queryFirst(document, SELECTORS.mainbar);

    if (mainbar && mainbar.parentNode && !panel.isConnected) {
      mainbar.parentNode.insertBefore(panel, mainbar);
    }
  }

  function limitCheckedOptions(options, maxSuggestions) {
    let used = 0;
    return options.map((option) => {
      if (option.id === 'intro' || option.id === 'answer-context' || option.id === 'context') {
        return option;
      }

      if (!option.checked) {
        return option;
      }

      used += 1;
      if (used <= maxSuggestions) {
        return option;
      }

      return { ...option, checked: false };
    });
  }

  function buildCommentOptions(context) {
    const strings = t();
    const comments = strings.comments;
    const commentContext = context || {
      postType: 'question',
      suggestions: ATSU.state.suggestions,
      author: getQuestionAuthorName()
    };
    const suggestionKeys = new Set(commentContext.suggestions.map((suggestion) => suggestion.key));
    const site = getSiteName();
    const questionContext = buildQuestionContext();
    const maxSuggestions = (ATSU.state.config && ATSU.state.config.commentMaxSuggestions) || 2;
    const metaSite = isMetaSite() && commentContext.postType === 'question' && ATSU.state.config && ATSU.state.config.smartTemplates !== false;

    if (commentContext.postType === 'answer') {
      const options = [
        { id: 'intro', label: comments.answerIntro.replace('{author}', formatAuthorPlaceholder(commentContext)), checked: true },
        { id: 'answer-context', label: comments.answerContext, checked: false },
        { id: 'answer-not-answer', label: comments.answerNotAnswer, checked: suggestionKeys.has('answerNotAnswer') },
        { id: 'answer-link-only', label: comments.answerLinkOnly, checked: suggestionKeys.has('answerLinkOnly') },
        { id: 'answer-explain', label: comments.answerExplain, checked: suggestionKeys.has('answerExplain') || suggestionKeys.size === 0 },
        { id: 'answer-code', label: comments.answerCode, checked: suggestionKeys.has('answerCode') },
        { id: 'answer-format', label: comments.answerFormat, checked: suggestionKeys.has('answerFormat') },
        { id: 'image', label: comments.image, checked: suggestionKeys.has('image') },
        { id: 'language', label: comments.language, checked: suggestionKeys.has('language') },
        { id: 'thanks', label: comments.thanks, checked: false }
      ];
      return limitCheckedOptions(options, maxSuggestions);
    }

    if (metaSite) {
      const options = [
        { id: 'intro', label: comments.metaIntro.replace('{site}', site).replace('{author}', formatAuthorPlaceholder(commentContext)), checked: true },
        { id: 'context', label: questionContext, checked: false },
        { id: 'meta-steps', label: comments.metaSteps, checked: suggestionKeys.has('metaSteps') || suggestionKeys.size === 0 },
        { id: 'meta-expected', label: comments.metaExpected, checked: suggestionKeys.has('metaExpected') },
        { id: 'meta-context', label: comments.metaContext, checked: suggestionKeys.has('metaContext') },
        { id: 'meta-scope', label: comments.metaScope, checked: suggestionKeys.has('metaScope') },
        { id: 'language', label: comments.language, checked: suggestionKeys.has('notlang1') || suggestionKeys.has('notlang2') },
        { id: 'thanks', label: comments.thanks, checked: false }
      ].filter((option) => option.id !== 'context' || option.label);
      return limitCheckedOptions(options, maxSuggestions);
    }

    const options = [
      {
        id: 'intro',
        label: comments.intro.replace('{site}', site).replace('{author}', formatAuthorPlaceholder(commentContext)),
        checked: true
      }
    ];

    if (questionContext) {
      options.push({ id: 'context', label: questionContext, checked: false });
    }

    options.push(
      { id: 'image', label: comments.image, checked: suggestionKeys.has('onlyimg') },
      { id: 'format', label: comments.format, checked: suggestionKeys.has('noformatcode') || suggestionKeys.has('post2') },
      { id: 'mre', label: comments.mre, checked: suggestionKeys.has('post1') },
      { id: 'explain', label: comments.explain, checked: suggestionKeys.has('content1') || suggestionKeys.has('content2') || suggestionKeys.has('effort') || suggestionKeys.has('broad') },
      { id: 'language', label: comments.language, checked: suggestionKeys.has('notlang1') || suggestionKeys.has('notlang2') },
      { id: 'thanks', label: comments.thanks, checked: false }
    );

    return limitCheckedOptions(options, maxSuggestions);
  }

  function composeComment(options, form) {
    const selected = options
      .filter((option) => form.querySelector(`[data-atsu-option="${option.id}"]`).checked)
      .map((option) => option.label.trim())
      .filter(Boolean);

    return selected.join(' ');
  }

  function openCommentAssistant(textarea) {
    const strings = t();
    const commentContext = getCommentContext(textarea);
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : textarea;
    const existing = document.getElementById(ATSU.ids.modal);

    if (existing) {
      existing.remove();
    }

    const options = buildCommentOptions(commentContext);
    const modal = document.createElement('div');
    modal.id = ATSU.ids.modal;

    const dialog = document.createElement('div');
    dialog.className = 'atsu-v2-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const title = document.createElement('h2');
    title.id = 'atsu-v2-modal-title';
    dialog.setAttribute('aria-labelledby', title.id);
    title.textContent = commentContext.postType === 'answer'
      ? `${strings.modalTitle} (${getLanguage() === 'ES' ? 'respuesta' : 'answer'})`
      : `${strings.modalTitle} (${getLanguage() === 'ES' ? 'pregunta' : 'question'})`;
    dialog.appendChild(title);

    const form = document.createElement('form');

    options.forEach((option) => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = option.checked;
      checkbox.dataset.atsuOption = option.id;

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${option.label}`));
      form.appendChild(label);
    });

    const preview = document.createElement('textarea');
    preview.maxLength = 600;
    preview.value = composeComment(options, form);
    form.appendChild(preview);

    const counter = document.createElement('div');
    counter.className = 'atsu-v2-counter';
    form.appendChild(counter);

    function updateCounter() {
      counter.textContent = `${preview.value.length}/600`;
      counter.classList.toggle('atsu-v2-counter-warning', preview.value.length > 520);
    }

    form.addEventListener('change', () => {
      preview.value = composeComment(options, form);
      updateCounter();
    });

    preview.addEventListener('input', updateCounter);
    updateCounter();

    const actions = document.createElement('div');
    actions.className = 'atsu-v2-actions';

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = strings.close;

    function closeModal() {
      document.removeEventListener('keydown', handleModalKeydown);
      modal.remove();
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    }

    function handleModalKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    }

    close.addEventListener('click', closeModal);

    const insert = document.createElement('button');
    insert.type = 'button';
    insert.textContent = strings.insert;
    insert.addEventListener('click', () => {
      textarea.value = preview.value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      textarea.focus();
      document.removeEventListener('keydown', handleModalKeydown);
      modal.remove();
    });

    actions.appendChild(close);
    actions.appendChild(insert);
    form.appendChild(actions);
    dialog.appendChild(form);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
    document.addEventListener('keydown', handleModalKeydown);
    const firstCheckbox = form.querySelector('input[type="checkbox"]');
    (firstCheckbox || close).focus();
  }

  function attachCommentAssistant(root = document) {
    if (!ATSU.state.config || !ATSU.state.config.comments) {
      return;
    }

    const strings = t();
    const textareas = queryAllIncludingRoot(root, SELECTORS.commentTextareas);

    textareas.forEach((textarea) => {
      if (textarea.dataset.atsuCommentReady === '1') {
        return;
      }

      textarea.dataset.atsuCommentReady = '1';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'atsu-v2-comment-button';
      button.textContent = strings.commentAssistant;
      button.title = getPostType(findPostRootFromTextarea(textarea)) === 'answer'
        ? (getLanguage() === 'ES' ? 'Crear comentario ATSU para esta respuesta' : 'Build an ATSU comment for this answer')
        : (getLanguage() === 'ES' ? 'Crear comentario ATSU para esta pregunta' : 'Build an ATSU comment for this question');
      button.addEventListener('click', () => openCommentAssistant(textarea));

      textarea.insertAdjacentElement('afterend', button);
    });
  }


  function getCurrentQuestionIdFromLocation() {
    const match = window.location.pathname.match(/^\/questions\/(\d+)/);
    return match ? match[1] : '';
  }

  function isQuestionIdVisited(questionId) {
    const cleanId = String(questionId || '').trim();
    return cleanId ? ATSU.state.visitedQuestionIds.has(cleanId) : false;
  }

  function removeNewBadgeFromLink(link) {
    if (!link || !(link instanceof Element) || !link.parentElement) {
      return;
    }

    link.parentElement.querySelectorAll('.atsu-v2-badge-new').forEach((badge) => badge.remove());
    const card = link.closest('.s-post-summary, .question-summary, [id^="question-summary-"], article, li, div');
    if (card) {
      card.classList.remove('atsu-v2-new-post');
    }
  }

  async function markQuestionVisited(questionId, link = null) {
    const cleanId = normalizeQuestionId(questionId);

    if (!cleanId || isQuestionIdVisited(cleanId)) {
      if (link) {
        removeNewBadgeFromLink(link);
      }
      return;
    }

    ATSU.state.visitedQuestionIds.add(cleanId);

    if (link) {
      removeNewBadgeFromLink(link);
    }

    await sendMessage({
      action: 'ATSU_MARK_QUESTION_VISITED',
      origin: ATSU.state.origin,
      url: window.location.href,
      questionId: cleanId
    });
  }

  function markCurrentQuestionAsVisited() {
    const questionId = getCurrentQuestionIdFromLocation();

    if (questionId) {
      markQuestionVisited(questionId);
    }
  }

  function handleQuestionLinkActivation(event) {
    const link = event.target && event.target.closest
      ? event.target.closest('a[href^="/questions/"]')
      : null;

    if (!link) {
      return;
    }

    const questionId = getQuestionIdFromLink(link);
    if (questionId) {
      markQuestionVisited(questionId, link);
    }
  }

  function bindVisitedTracking() {
    if (document.documentElement.dataset.atsuVisitedTrackingReady === '1') {
      return;
    }

    document.documentElement.dataset.atsuVisitedTrackingReady = '1';
    document.addEventListener('click', handleQuestionLinkActivation, true);
    document.addEventListener('auxclick', handleQuestionLinkActivation, true);
  }

  function getQuestionIdFromLink(link) {
    try {
      const href = link.getAttribute('href') || '';
      return getQuestionIdFromUrl(href, window.location.origin);
    } catch (error) {
      return '';
    }
  }

  function getCardsFromRoot(root) {
    const cards = queryAllIncludingRoot(root, SELECTORS.questionCards);

    if (cards.length > 0) {
      return cards;
    }

    return queryAllIncludingRoot(root, SELECTORS.questionLinks)
      .map((link) => link.closest('div, article, section, li'))
      .filter(Boolean);
  }

  function getQuestionTitleLink(card) {
    if (!card || !(card instanceof Element)) {
      return null;
    }

    return queryFirst(card, SELECTORS.questionLinks);
  }

  function ensureQuestionBadge(link, type) {
    if (!link || !(link instanceof Element)) {
      return null;
    }

    const strings = t();
    const badgeClass = type === 'closed' ? 'atsu-v2-badge-closed' : 'atsu-v2-badge-new';
    const existing = link.parentElement ? link.parentElement.querySelector(`.${badgeClass}`) : null;

    if (existing) {
      existing.textContent = type === 'closed' ? strings.closedBadge : strings.newBadge;
      return existing;
    }

    const badge = document.createElement('span');
    badge.className = `atsu-v2-question-badge ${badgeClass}`;
    badge.textContent = type === 'closed' ? strings.closedBadge : strings.newBadge;
    badge.setAttribute('aria-label', type === 'closed' ? strings.closedBadge : strings.newBadge);
    badge.title = type === 'closed'
      ? (getLanguage() === 'ES' ? 'Pregunta cerrada' : 'Closed question')
      : (getLanguage() === 'ES' ? 'Pregunta nueva detectada por ATSU' : 'New question detected by ATSU');

    link.insertAdjacentElement('beforebegin', badge);
    return badge;
  }

  function markNewQuestionCard(card) {
    const link = getQuestionTitleLink(card);

    if (!link) {
      return;
    }

    card.classList.add('atsu-v2-new-post');
    ensureQuestionBadge(link, 'new');
  }

  function isClosedQuestionCard(card, link) {
    if (!card || !(card instanceof Element)) {
      return false;
    }

    const className = String(card.className || '').toLowerCase();
    if (className.includes('closed') || className.includes('deleted')) {
      return true;
    }

    if (card.matches('.s-post-summary--closed, .question-summary.closed, [class*="closed"], [data-status="closed"]')) {
      return true;
    }

    const titleText = normalizeSpaces(`${link ? link.textContent : ''} ${link ? link.getAttribute('title') || '' : ''}`).toLowerCase();
    if (/\[(closed|duplicate|duplicad[ao]s?|cerrad[ao]s?|cerrada)\]/i.test(titleText)) {
      return true;
    }

    return Boolean(card.querySelector('[title*="closed" i], [aria-label*="closed" i], [title*="cerrad" i], [aria-label*="cerrad" i], .s-post-summary--closed, .question-status'));
  }

  function markClosedQuestionCards(root = document) {
    getCardsFromRoot(root).forEach((card) => {
      const link = getQuestionTitleLink(card);

      if (!link || !isClosedQuestionCard(card, link)) {
        return;
      }

      ensureQuestionBadge(link, 'closed');
    });
  }


  function markVisibleNewQuestionCards(root = document) {
    if (!ATSU.state.config || !ATSU.state.config.newPosts || !isQuestionListPage()) {
      return;
    }

    // ATSU uses "NEW/NUEVO" in the user's sense: the question has not been
    // visited through ATSU yet. We intentionally do not request browser history
    // permission, so pre-existing Chrome history is not read.
    getCardsFromRoot(root).forEach((card) => {
      const link = getQuestionTitleLink(card);

      if (!link) {
        return;
      }

      const id = getQuestionIdFromLink(link);
      if (!id || isQuestionIdVisited(id)) {
        removeNewBadgeFromLink(link);
        return;
      }

      markNewQuestionCard(card);
    });
  }

  function registerInitialQuestions() {
    queryAll(document, SELECTORS.questionLinks).forEach((link) => {
      const id = getQuestionIdFromLink(link);

      if (id) {
        ATSU.state.initialQuestionIds.add(id);
      }
    });
  }

  function showToast(message) {
    let toast = document.getElementById(ATSU.ids.toast);

    if (!toast) {
      toast = document.createElement('div');
      toast.id = ATSU.ids.toast;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.remove(), 4500);
  }

  function processDynamicQuestions(root) {
    if (!ATSU.state.config || !ATSU.state.config.newPosts || isQuestionPage()) {
      return;
    }

    getCardsFromRoot(root).forEach((card) => {
      const link = getQuestionTitleLink(card);
      if (!link) {
        return;
      }

      if (isClosedQuestionCard(card, link)) {
        ensureQuestionBadge(link, 'closed');
      }

      const id = getQuestionIdFromLink(link);
      if (!id || isQuestionIdVisited(id)) {
        removeNewBadgeFromLink(link);
        return;
      }

      if (!ATSU.state.initialQuestionIds.has(id)) {
        ATSU.state.initialQuestionIds.add(id);
        ATSU.state.newPostCount += 1;
        showToast(`${t().newPost}: ${ATSU.state.newPostCount}`);
      }
      markNewQuestionCard(card);
    });
  }

  function flushDynamicRoots() {
    ATSU.state.refreshScheduled = false;
    if (!document.defaultView) {
      ATSU.state.pendingRoots.clear();
      return;
    }

    const roots = [...ATSU.state.pendingRoots];
    ATSU.state.pendingRoots.clear();
    roots.forEach((root) => {
      attachCommentAssistant(root);
      markClosedQuestionCards(root);
      markVisibleNewQuestionCards(root);
      processDynamicQuestions(root);
    });
  }

  function scheduleDynamicRefresh(root) {
    ATSU.state.pendingRoots.add(root);
    if (ATSU.state.refreshScheduled) {
      return;
    }
    ATSU.state.refreshScheduled = true;
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    schedule(flushDynamicRoots);
  }

  function startDynamicObserver() {
    if (!document.body || ATSU.state.observer) {
      return;
    }

    registerInitialQuestions();
    ATSU.state.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            scheduleDynamicRefresh(node);
          }
        });
      });
    });
    ATSU.state.observer.observe(document.body, { childList: true, subtree: true });
  }

  async function boot() {
    const response = await sendMessage({
      action: 'ATSU_GET_CONTENT_STATE',
      url: window.location.href
    });

    if (!response || !response.ok || !response.supported || !response.config || !response.config.enabled) {
      return;
    }

    ATSU.state.config = normalizeSiteConfig(response.config);
    ATSU.state.origin = response.origin || window.location.origin;
    ATSU.state.visitedQuestionIds = new Set(Array.isArray(response.visitedQuestionIds) ? response.visitedQuestionIds.map(String) : []);

    ensureStyles(ATSU.state.config);
    applyLinkHighlighting(ATSU.state.config);

    bindVisitedTracking();
    markCurrentQuestionAsVisited();

    const suggestions = analyzePost(ATSU.state.config);
    renderPanel(suggestions);
    markClosedQuestionCards(document);
    markVisibleNewQuestionCards(document);
    attachCommentAssistant();
    startDynamicObserver();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.action === 'ATSU_PREVIEW_COLORS') {
      const previewConfig = {
        ...(ATSU.state.config || {}),
        colors: message.colors !== false,
        rgbColors: message.rgbColors || {}
      };

      ensureStyles(previewConfig);
      applyLinkHighlighting(previewConfig);
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === 'ATSU_CLEAR_PREVIEW') {
      if (ATSU.state.config) {
        ensureStyles(ATSU.state.config);
        applyLinkHighlighting(ATSU.state.config);
      } else {
        document.documentElement.classList.remove('atsu-v2-link-color');
      }

      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  boot();
})();
