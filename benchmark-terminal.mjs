import {
  answerTerminalQuestion,
  TERMINAL_CATALOG,
} from './terminal-answer.mjs';

const agentCode = (process.env.BENCHMARK_AGENT_CODE || 'A1B2C3D4E5F6')
  .replace(/\s+/g, '')
  .toUpperCase();
const rounds = Number(process.env.BENCHMARK_ROUNDS || 10_000);

if (!/^[0-9A-F]{12}$/.test(agentCode)) {
  throw new Error('BENCHMARK_AGENT_CODE deve ter 12 caracteres hexadecimais.');
}
if (!Number.isInteger(rounds) || rounds <= 0) {
  throw new Error('BENCHMARK_ROUNDS deve ser um inteiro maior que zero.');
}

const pairs = agentCode.match(/.{2}/g);
const fragments = {
  alpha: agentCode.slice(0, 4),
  beta: agentCode.slice(4, 8),
  gamma: agentCode.slice(8, 12),
};

const questions = [
  ...TERMINAL_CATALOG.slice(0, 4).map((entry, index) => ({
    questionNumber: index + 1,
    question: entry.question,
    contexts: [],
    options: entry.options,
    expected: {
      kind: 'choice',
      value: entry.correctAnswer,
    },
  })),
  {
    questionNumber: 5,
    question: TERMINAL_CATALOG[4].question,
    contexts: [`agent_code = "${agentCode}"`],
    options: [],
    expected: { kind: 'text', value: [...agentCode].reverse().join('') },
  },
  {
    questionNumber: 6,
    question: TERMINAL_CATALOG[5].question,
    contexts: [Buffer.from(`T77|${agentCode}`, 'utf8').toString('base64')],
    options: [],
    expected: { kind: 'text', value: `T77|${agentCode}` },
  },
  {
    questionNumber: 7,
    question: TERMINAL_CATALOG[6].question,
    contexts: [
      JSON.stringify(
        { fragments, route: ['gamma', 'alpha', 'beta'] },
        null,
        2,
      ),
    ],
    options: [],
    expected: {
      kind: 'text',
      value: `${fragments.gamma}${fragments.alpha}${fragments.beta}`,
    },
  },
  {
    questionNumber: 8,
    question: TERMINAL_CATALOG[7].question,
    contexts: [sqliteContext(agentCode)],
    options: [],
    expected: {
      kind: 'text',
      value: `${agentCode}:${pairs.reduce(
        (sum, pair) => sum + Number.parseInt(pair, 16),
        0,
      )}`,
    },
  },
  {
    questionNumber: 9,
    question: TERMINAL_CATALOG[8].question,
    contexts: [pairContext(agentCode)],
    options: [],
    expected: {
      kind: 'text',
      value: pairs
        .map((pair, index) =>
          index % 2 === 1 ? [...pair].reverse().join('') : pair,
        )
        .reverse()
        .join('-'),
    },
  },
  {
    questionNumber: 10,
    question: TERMINAL_CATALOG[9].question,
    contexts: [finalContext(agentCode)],
    options: [],
    expected: { kind: 'text', value: finalToken(agentCode) },
  },
];

function sqliteContext(code) {
  return `WITH packets(agent, bytes) AS (
  VALUES
${code
  .match(/.{2}/g)
  .map((pair) => `    ('${code}', 0x${pair})`)
  .join(',\n')},
    ('DECOY', 0x4D),
    ('DECOY', 0x2A)
)
SELECT agent || ':' || SUM(bytes)
FROM packets
WHERE agent = '${code}'
GROUP BY agent;`;
}

function pairContext(code) {
  return `function transform(code) {
  return code.match(/.{2}/g)
    .map((pair, index) =>
      index % 2 === 1 ? [...pair].reverse().join("") : pair
    )
    .reverse()
    .join("-");
}
transform("${code}");`;
}

function finalContext(code) {
  return `HEX = "0123456789ABCDEF"

para cada caractere do agent_code:
  novo = HEX[(HEX.indexOf(caractere) + índice + 7) % 16]
token = "T77-" + caracteres_transformados
agent_code = "${code}"

exemplo independente: "0000" → "789A"`;
}

function finalToken(code) {
  const hex = '0123456789ABCDEF';
  return `T77-${[...code]
    .map(
      (character, index) =>
        hex[(hex.indexOf(character) + index + 7) % hex.length],
    )
    .join('')}`;
}

for (const task of questions) {
  const answer = answerTerminalQuestion(task);
  const actual = answer.kind === 'choice' ? answer.index : answer.text;
  if (answer.kind !== task.expected.kind || actual !== task.expected.value) {
    throw new Error(
      `Falha na questão ${task.questionNumber}: recebido ${JSON.stringify(actual)}, esperado ${JSON.stringify(task.expected.value)}.`,
    );
  }
  console.log(
    `PASS ${String(task.questionNumber).padStart(2, '0')} ${answer.questionId}: ${JSON.stringify(actual)}`,
  );
}

const startedAt = performance.now();
for (let round = 0; round < rounds; round += 1) {
  for (const task of questions) answerTerminalQuestion(task);
}
const elapsedMs = performance.now() - startedAt;
const answerCount = rounds * questions.length;

console.log(
  `\nBenchmark local: ${answerCount.toLocaleString('pt-BR')} respostas em ${elapsedMs.toFixed(2)} ms.`,
);
console.log(
  `Média do resolvedor: ${((elapsedMs * 1_000) / answerCount).toFixed(2)} µs por resposta.`,
);
