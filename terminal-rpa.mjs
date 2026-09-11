import { existsSync } from 'node:fs';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { chromium } from 'playwright';

import { validateTerminalClientCatalog } from './terminal-answer.mjs';
import { runTerminalTurbo } from './terminal-turbo.mjs';

const TERMINAL_URL =
  process.env.QUIZ_URL || 'https://aquinointer.tech/terminal-77';
const FORUM_HANDLE = process.env.FORUM_HANDLE?.trim();
const HEADLESS = process.env.HEADLESS !== '0';
const SLOW_MO_MS = readNonNegativeNumber('SLOW_MO_MS', 0);
const KEEP_OPEN_MS = readNonNegativeNumber('KEEP_OPEN_MS', 0);
const MAX_QUESTIONS = readPositiveInteger('MAX_QUESTIONS', 10);
const AUTH_TIMEOUT_MS = readPositiveInteger('AUTH_TIMEOUT_MS', 10 * 60_000);
const QR_CAPTURE_INTERVAL_MS = readPositiveInteger(
  'QR_CAPTURE_INTERVAL_MS',
  30_000,
);
const CAPTURE_AUTH_QR = process.env.CAPTURE_AUTH_QR === '1';
const INSPECT_ONLY = process.env.INSPECT_ONLY === '1';
const PAUSE_BEFORE_START = process.env.PAUSE_BEFORE_START === '1';
const USER_DATA_DIR = process.env.USER_DATA_DIR;
const BROWSER_CHANNEL =
  process.env.BROWSER_CHANNEL ||
  (process.platform === 'win32' ? 'msedge' : undefined);

const SELECTORS = {
  handle:
    process.env.HANDLE_SELECTOR || '#forum-handle, #tech-forum-handle',
  start: process.env.START_BUTTON_SELECTOR || 'button',
  result: process.env.RESULT_SELECTOR || '.tech-result-card',
  resultScore:
    process.env.RESULT_SCORE_SELECTOR || '.tech-result-score',
  resultStats:
    process.env.RESULT_STATS_SELECTOR || '.tech-result-grid',
  rankingLoading:
    process.env.RANKING_LOADING_SELECTOR || '.tech-ranking-loading',
};

function readNonNegativeNumber(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} deve ser um número maior ou igual a zero.`);
  }
  return value;
}

function readPositiveInteger(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro maior que zero.`);
  }
  return value;
}

function normalizeText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

async function firstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function waitForFirstVisible(page, selector, description) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const candidate = await firstVisible(page.locator(selector));
    if (candidate) return candidate;
    await page.waitForTimeout(10);
  }
  throw new Error(`Tempo esgotado aguardando: ${description}`);
}

async function findReadyButton(page, labels, selector = 'button') {
  const buttons = page.locator(selector);
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const text = normalizeText(await button.innerText().catch(() => ''));
    const matches = labels.some((label) =>
      text.toLocaleLowerCase('pt-BR').startsWith(label),
    );
    if (
      matches &&
      (await button.isVisible().catch(() => false)) &&
      (await button.isEnabled().catch(() => false))
    ) {
      return button;
    }
  }
  return null;
}

async function pauseBeforeStart() {
  const readline = createInterface({ input, output });
  try {
    await readline.question(
      'Confira a autenticação e pressione Enter para iniciar o desafio. ',
    );
  } finally {
    readline.close();
  }
}

async function captureQrArtifacts(page, sequence) {
  await page.screenshot({ path: 'terminal-77-qrcode.png', fullPage: true });

  const candidates = page.locator('canvas, img, svg');
  const candidateCount = await candidates.count();
  let bestCandidate = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = candidates.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const box = await candidate.boundingBox().catch(() => null);
    if (!box || box.width < 120 || box.height < 120) continue;

    const ratioPenalty = Math.abs(box.width - box.height);
    const sizePenalty = Math.abs(Math.min(box.width, box.height) - 256) / 10;
    const score = ratioPenalty + sizePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    await bestCandidate
      .screenshot({ path: 'terminal-77-qrcode-only.png' })
      .catch(() => {});
  }

  console.log(
    `QR ${sequence} salvo em terminal-77-qrcode.png` +
      (bestCandidate ? ' e terminal-77-qrcode-only.png.' : '.'),
  );
}

async function authenticateWithInterQr(originalPage) {
  const loginDeadline = Date.now() + 30_000;
  let loginButton = null;

  while (Date.now() < loginDeadline && !loginButton) {
    const authenticatedState = await firstVisible(
      originalPage.locator(
        `${SELECTORS.handle}, .tech-start-form, .tech-question-card, .tech-result-card`,
      ),
    );
    if (authenticatedState) return originalPage;

    loginButton = await findReadyButton(originalPage, [
      'entrar com conta inter',
    ]);
    if (!loginButton) await originalPage.waitForTimeout(100);
  }
  if (!loginButton) {
    throw new Error('Botão ENTRAR COM CONTA INTER não foi encontrado.');
  }

  const popupPromise = originalPage
    .waitForEvent('popup', { timeout: 5_000 })
    .catch(() => null);
  await loginButton.click();
  const authPage = (await popupPromise) || originalPage;

  await authPage
    .waitForURL(/id\.inter\.co\/a\/authentication\/aquinointer\/qrcode/i, {
      timeout: 30_000,
    })
    .catch(() => {});
  await authPage.waitForLoadState('domcontentloaded').catch(() => {});
  await authPage.waitForTimeout(1_000);

  const deadline = Date.now() + AUTH_TIMEOUT_MS;
  let nextCaptureAt = 0;
  let sequence = 0;

  while (Date.now() < deadline) {
    if (authPage.isClosed()) {
      await originalPage.waitForTimeout(1_000);
      await originalPage.goto(TERMINAL_URL, { waitUntil: 'domcontentloaded' });
      if (await firstVisible(originalPage.locator(SELECTORS.handle))) {
        console.log('Autenticação concluída; sessão preservada no perfil local.');
        return originalPage;
      }
      throw new Error('A janela do QR fechou sem confirmar a autenticação.');
    }

    const currentUrl = new URL(authPage.url());
    if (
      currentUrl.hostname === 'aquinointer.tech' &&
      (await firstVisible(authPage.locator(SELECTORS.handle)))
    ) {
      console.log('Autenticação concluída; sessão preservada no perfil local.');
      return authPage;
    }

    if (Date.now() >= nextCaptureAt) {
      sequence += 1;
      await captureQrArtifacts(authPage, sequence);
      nextCaptureAt = Date.now() + QR_CAPTURE_INTERVAL_MS;
    }

    const refreshButton = await findReadyButton(authPage, [
      'gerar novo qr',
      'gerar novo código',
      'gerar novo codigo',
      'atualizar qr',
      'tentar novamente',
    ]);
    if (refreshButton) {
      await refreshButton.click();
      await authPage.waitForTimeout(500);
      nextCaptureAt = 0;
    }

    await authPage.waitForTimeout(1_000);
  }

  throw new Error(
    `Autenticação por QR não foi concluída em ${AUTH_TIMEOUT_MS} ms.`,
  );
}

async function inspectPage(page) {
  const visibleElements = await page.evaluate(() => {
    const normalize = (value) => value?.replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    };

    return [
      ...document.querySelectorAll(
        'h1, h2, h3, button, input, textarea, [contenteditable="true"]',
      ),
    ]
      .filter(isVisible)
      .map((element) => ({
        tag: element.tagName.toLocaleLowerCase(),
        id: element.id || null,
        className:
          typeof element.className === 'string' && element.className
            ? element.className
            : null,
        type: element.getAttribute('type'),
        text: normalize(element.textContent) || null,
        placeholder: element.getAttribute('placeholder'),
      }));
  });

  await page.screenshot({ path: 'quiz-inspect.png', fullPage: true });
  console.log(
    JSON.stringify(
      {
        url: page.url(),
        title: await page.title(),
        visibleElements,
      },
      null,
      2,
    ),
  );
  console.log('\nInspeção concluída sem clicar em EXECUTAR.');
}

function assertTerminalUrl() {
  const url = new URL(TERMINAL_URL);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'aquinointer.tech' ||
    url.pathname.replace(/\/$/, '') !== '/terminal-77'
  ) {
    throw new Error(
      'Este RPA foi limitado ao desafio https://aquinointer.tech/terminal-77.',
    );
  }
}

function browserLaunchOptions() {
  const options = { headless: HEADLESS, slowMo: SLOW_MO_MS };
  if (BROWSER_CHANNEL) options.channel = BROWSER_CHANNEL;

  const localBrowserLibs = path.resolve(
    '.playwright-libs/usr/lib/x86_64-linux-gnu',
  );
  if (process.platform === 'linux' && existsSync(localBrowserLibs)) {
    options.env = {
      ...process.env,
      LD_LIBRARY_PATH: [localBrowserLibs, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(':'),
    };
  }
  return options;
}

async function runTerminalRpa() {
  assertTerminalUrl();
  if (!INSPECT_ONLY && !FORUM_HANDLE) {
    throw new Error('FORUM_HANDLE é obrigatório para executar o desafio.');
  }

  const launchOptions = browserLaunchOptions();
  const contextOptions = {
    locale: 'pt-BR',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
  };
  const browser = USER_DATA_DIR
    ? null
    : await chromium.launch(launchOptions);
  const context = USER_DATA_DIR
    ? await chromium.launchPersistentContext(USER_DATA_DIR, {
        ...launchOptions,
        ...contextOptions,
      })
    : await browser.newContext(contextOptions);
  let page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(15_000);

  try {
    await page.goto(TERMINAL_URL, { waitUntil: 'domcontentloaded' });
    if (CAPTURE_AUTH_QR) page = await authenticateWithInterQr(page);

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `,
    });

    const validation = await validateTerminalClientCatalog(page);
    console.log(
      `Catálogo local validado contra ${validation.url} (${validation.bytes} bytes).`,
    );

    const resumingAttempt = Boolean(
      await firstVisible(page.locator('.tech-question-card')),
    );
    if (resumingAttempt) {
      console.log('Tentativa em andamento encontrada; retomando-a.');
    }

    if (INSPECT_ONLY) {
      await inspectPage(page);
      if (KEEP_OPEN_MS > 0) await page.waitForTimeout(KEEP_OPEN_MS);
      return;
    }

    const handleInput = await firstVisible(page.locator(SELECTORS.handle));
    if (handleInput) await handleInput.fill(FORUM_HANDLE);

    await page
      .locator(SELECTORS.rankingLoading)
      .waitFor({ state: 'hidden', timeout: 10_000 })
      .catch(() => {});

    if (PAUSE_BEFORE_START && !resumingAttempt) await pauseBeforeStart();

    const startButton = await findReadyButton(
      page,
      ['executar', 'iniciar', 'começar', 'comecar'],
      SELECTORS.start,
    );
    if (startButton) await startButton.click();

    await waitForFirstVisible(
      page,
      '.tech-question-card, .tech-result-card',
      'início ou retomada do Terminal 77',
    );
    await runTerminalTurbo(page, { maxQuestions: MAX_QUESTIONS });

    const result = page.locator(SELECTORS.result);
    await result.waitFor({ state: 'visible' });
    const scoreLocator = result.locator(SELECTORS.resultScore);
    const statsLocator = result.locator(SELECTORS.resultStats);
    const score = normalizeText(
      (await scoreLocator.count()) > 0
        ? await scoreLocator.first().innerText()
        : await result.innerText(),
    );
    const stats =
      (await statsLocator.count()) > 0
        ? normalizeText(await statsLocator.first().innerText())
        : '';

    if (!/\b3(?:[.\s])?000\b/.test(score)) {
      throw new Error(`Pontuação inesperada: ${score}`);
    }
    console.log(`\nResultado: ${score}${stats ? ` — ${stats}` : ''}`);

    if (KEEP_OPEN_MS > 0) {
      console.log(`Fechando o navegador em ${KEEP_OPEN_MS} ms...`);
      await page.waitForTimeout(KEEP_OPEN_MS);
    }
  } catch (error) {
    const screenshotPath = 'quiz-error.png';
    await page
      .screenshot({ path: screenshotPath, fullPage: true })
      .catch(() => {});
    console.error(`Falha no RPA. Captura salva em ${screenshotPath}.`);
    throw error;
  } finally {
    await context.close();
    if (browser?.isConnected()) await browser.close();
  }
}

await runTerminalRpa();
