import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { TERMINAL_CATALOG } from '../terminal-answer.mjs';
import { runTerminalTurbo } from '../terminal-turbo.mjs';

const AGENT_CODE = 'A1B2C3D4E5F6';
const PAIRS = AGENT_CODE.match(/.{2}/g);
const HEX = '0123456789ABCDEF';

function challengeTasks() {
  const contexts = [
    `agent_code = "${AGENT_CODE}"`,
    Buffer.from(`T77|${AGENT_CODE}`).toString('base64'),
    JSON.stringify(
      {
        fragments: { alpha: 'A1B2', beta: 'C3D4', gamma: 'E5F6' },
        route: ['gamma', 'alpha', 'beta'],
      },
      null,
      2,
    ),
    `WITH packets(agent, bytes) AS (
  VALUES
${PAIRS.map((pair) => `    ('${AGENT_CODE}', 0x${pair})`).join(',\n')},
    ('DECOY', 0x4D),
    ('DECOY', 0x2A)
)
SELECT agent || ':' || SUM(bytes)
FROM packets
WHERE agent = '${AGENT_CODE}'
GROUP BY agent;`,
    `function transform(code) {
  return code.match(/.{2}/g)
    .map((pair, index) =>
      index % 2 === 1 ? [...pair].reverse().join("") : pair
    )
    .reverse()
    .join("-");
}
transform("${AGENT_CODE}");`,
    `HEX = "0123456789ABCDEF"

para cada caractere do agent_code:
  novo = HEX[(HEX.indexOf(caractere) + índice + 7) % 16]
token = "T77-" + caracteres_transformados
agent_code = "${AGENT_CODE}"

exemplo independente: "0000" → "789A"`,
  ];
  const expected = [
    [...AGENT_CODE].reverse().join(''),
    `T77|${AGENT_CODE}`,
    'E5F6A1B2C3D4',
    `${AGENT_CODE}:${PAIRS.reduce(
      (sum, pair) => sum + Number.parseInt(pair, 16),
      0,
    )}`,
    '6F-E5-4D-C3-2B-A1',
    `T77-${[...AGENT_CODE]
      .map(
        (character, index) =>
          HEX[(HEX.indexOf(character) + index + 7) % HEX.length],
      )
      .join('')}`,
  ];

  return TERMINAL_CATALOG.map((entry, index) => ({
    question: entry.question,
    options: entry.options || [],
    context: index >= 4 ? contexts[index - 4] : '',
    expected:
      entry.kind === 'choice' ? entry.correctAnswer : expected[index - 4],
  }));
}

test('modo turbo percorre as 10 questões pelo DOM', async () => {
  const localBrowserLibs = path.resolve(
    '.playwright-libs/usr/lib/x86_64-linux-gnu',
  );
  const launchOptions = { headless: true };
  if (process.platform === 'linux' && existsSync(localBrowserLibs)) {
    launchOptions.env = {
      ...process.env,
      LD_LIBRARY_PATH: [localBrowserLibs, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(':'),
    };
  }

  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  try {
    await page.setContent('<main id="app"></main>');
    await page.evaluate(({ tasks, agentCode }) => {
      let current = 0;
      const app = document.querySelector('#app');

      function render() {
        const task = tasks[current];
        if (!task) {
          app.innerHTML = '<section class="tech-result-card">3000 / 3000</section>';
          return;
        }

        const options = task.options
          .map(
            (option) =>
              `<button class="tech-option"><strong>${option}</strong></button>`,
          )
          .join('');
        app.innerHTML = `<section class="tech-question-card">
          <span>QUESTÃO ${String(current + 1).padStart(2, '0')} / 10</span>
          <h1>${task.question}</h1>
          <div class="tech-agent-code">AGENT_CODE ${agentCode}</div>
          ${task.context ? `<pre class="tech-challenge-code"></pre>` : ''}
          <div class="options">${options}</div>
          ${task.options.length ? '' : '<input id="tech-challenge-answer" />'}
          <button class="confirm" disabled>CONFIRMAR</button>
          <div class="actions"></div>
        </section>`;
        const card = app.querySelector('.tech-question-card');
        const code = card.querySelector('.tech-challenge-code');
        if (code) code.textContent = task.context;

        let selected = null;
        card.querySelectorAll('.tech-option').forEach((option, index) => {
          option.addEventListener('click', () => {
            selected = index;
            card.querySelector('.confirm').disabled = false;
          });
        });
        const input = card.querySelector('#tech-challenge-answer');
        input?.addEventListener('input', (event) => {
          selected = event.target.value;
          card.querySelector('.confirm').disabled = !selected;
        });
        card.querySelector('.confirm').addEventListener('click', () => {
          setTimeout(() => {
            if (selected !== task.expected) {
              card.insertAdjacentHTML(
                'beforeend',
                '<div class="tech-attempt-notice">Resposta não validada.</div>',
              );
              return;
            }
            const next = document.createElement('button');
            next.textContent = 'PRÓXIMO TESTE';
            next.addEventListener('click', () => {
              current += 1;
              render();
            });
            card.querySelector('.actions').append(next);
          }, 1);
        });
      }

      render();
    }, { tasks: challengeTasks(), agentCode: AGENT_CODE });

    await runTerminalTurbo(page);
    await assert.doesNotReject(() =>
      page.locator('.tech-result-card').waitFor({ state: 'visible' }),
    );
  } finally {
    await browser.close();
  }
});
