import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerTerminalQuestion,
  TERMINAL_CATALOG,
} from '../terminal-answer.mjs';

const AGENT_CODE = 'A1B2C3D4E5F6';
const PAIRS = AGENT_CODE.match(/.{2}/g);

const openCases = [
  {
    number: 5,
    context: `agent_code = "${AGENT_CODE}"`,
    expected: '6F5E4D3C2B1A',
  },
  {
    number: 6,
    context: Buffer.from(`T77|${AGENT_CODE}`).toString('base64'),
    expected: `T77|${AGENT_CODE}`,
  },
  {
    number: 7,
    context: JSON.stringify(
      {
        fragments: { alpha: 'A1B2', beta: 'C3D4', gamma: 'E5F6' },
        route: ['gamma', 'alpha', 'beta'],
      },
      null,
      2,
    ),
    expected: 'E5F6A1B2C3D4',
  },
  {
    number: 8,
    context: `WITH packets(agent, bytes) AS (
  VALUES
${PAIRS.map((pair) => `    ('${AGENT_CODE}', 0x${pair})`).join(',\n')},
    ('DECOY', 0x4D),
    ('DECOY', 0x2A)
)
SELECT agent || ':' || SUM(bytes)
FROM packets
WHERE agent = '${AGENT_CODE}'
GROUP BY agent;`,
    expected: 'A1B2C3D4E5F6:1221',
  },
  {
    number: 9,
    context: `function transform(code) {
  return code.match(/.{2}/g)
    .map((pair, index) =>
      index % 2 === 1 ? [...pair].reverse().join("") : pair
    )
    .reverse()
    .join("-");
}
transform("${AGENT_CODE}");`,
    expected: '6F-E5-4D-C3-2B-A1',
  },
  {
    number: 10,
    context: `HEX = "0123456789ABCDEF"

para cada caractere do agent_code:
  novo = HEX[(HEX.indexOf(caractere) + índice + 7) % 16]
token = "T77-" + caracteres_transformados
agent_code = "${AGENT_CODE}"

exemplo independente: "0000" → "789A"`,
    expected: 'T77-194C7FA2D508',
  },
];

test('resolve as quatro alternativas fixas', () => {
  const expectedIndexes = [1, 1, 2, 3];
  for (let index = 0; index < 4; index += 1) {
    const entry = TERMINAL_CATALOG[index];
    const answer = answerTerminalQuestion({
      questionNumber: index + 1,
      question: entry.question,
      options: entry.options,
    });
    assert.equal(answer.kind, 'choice');
    assert.equal(answer.index, expectedIndexes[index]);
  }
});

for (const challenge of openCases) {
  test(`resolve a questão aberta ${challenge.number}`, () => {
    const answer = answerTerminalQuestion({
      questionNumber: challenge.number,
      question: TERMINAL_CATALOG[challenge.number - 1].question,
      contexts: [challenge.context],
      options: [],
    });
    assert.equal(answer.kind, 'text');
    assert.equal(answer.text, challenge.expected);
  });
}

test('recusa alternativa alterada antes de responder', () => {
  const entry = TERMINAL_CATALOG[0];
  assert.throws(
    () =>
      answerTerminalQuestion({
        questionNumber: 1,
        question: entry.question,
        options: [...entry.options].reverse(),
      }),
    /Catálogo do Terminal 77 não corresponde/,
  );
});

test('recusa especificação personalizada alterada', () => {
  const challenge = openCases.at(-1);
  assert.throws(
    () =>
      answerTerminalQuestion({
        questionNumber: challenge.number,
        question: TERMINAL_CATALOG[challenge.number - 1].question,
        contexts: [challenge.context.replace('índice + 7', 'índice + 8')],
      }),
    /Catálogo do Terminal 77 não corresponde/,
  );
});

test('recusa mudança na ordem das perguntas', () => {
  const entry = TERMINAL_CATALOG[1];
  assert.throws(
    () =>
      answerTerminalQuestion({
        questionNumber: 1,
        question: entry.question,
        options: entry.options,
      }),
    /posição 1/,
  );
});
