const HEX = '0123456789ABCDEF';

export const TERMINAL_CATALOG = Object.freeze([
  {
    id: 'shell-path',
    kind: 'choice',
    question: 'Depois destes comandos, qual caminho o terminal exibirá?',
    options: [
      '/home/aluno/projetos/logs',
      '/home/aluno/logs',
      '/home/logs',
      '/logs',
    ],
    correctAnswer: 1,
  },
  {
    id: 'http-session-created',
    kind: 'choice',
    question: 'O que este registro confirma sobre a requisição?',
    options: [
      'A requisição foi redirecionada',
      'O recurso de sessão foi criado',
      'A resposta necessariamente veio sem corpo',
      'A autenticação foi recusada',
    ],
    correctAnswer: 1,
  },
  {
    id: 'git-switch-branch',
    kind: 'choice',
    question: 'Qual comando cria a branch pista-77 e já muda para ela?',
    options: [
      'git branch pista-77',
      'git switch pista-77',
      'git switch -c pista-77',
      'git checkout pista-77 --create',
    ],
    correctAnswer: 2,
  },
  {
    id: 'javascript-pipeline',
    kind: 'choice',
    question: 'Qual valor será impresso por este pipeline?',
    options: ['10', '15', '19', '22'],
    correctAnswer: 3,
  },
  {
    id: 'reverse-agent-code',
    kind: 'text',
    question:
      'Inverta os 12 caracteres do seu código de agente, sem adicionar separadores.',
    solve: solveReverse,
  },
  {
    id: 'base64-agent-payload',
    kind: 'text',
    question:
      'Decodifique o payload Base64 e informe exatamente o conteúdo encontrado.',
    solve: solveBase64,
  },
  {
    id: 'json-fragment-route',
    kind: 'text',
    question:
      'Siga route e concatene os fragmentos correspondentes, sem separadores.',
    solve: solveJsonRoute,
  },
  {
    id: 'sqlite-agent-packets',
    kind: 'text',
    question:
      'Execute ou calcule esta consulta SQLite e informe a única linha retornada.',
    solve: solveSqlite,
  },
  {
    id: 'pair-transform',
    kind: 'text',
    question: 'Qual string a função retorna quando recebe seu código de agente?',
    solve: solvePairTransform,
  },
  {
    id: 'final-agent-token',
    kind: 'text',
    question:
      'Implemente a transformação em qualquer linguagem e informe o token final.',
    solve: solveFinalToken,
  },
]);

function normalizeText(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeAgentCode(value) {
  const code = String(value).replace(/\s+/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(code)) {
    throw mismatch(`Código de agente inválido: ${JSON.stringify(value)}.`);
  }
  return code;
}

function mismatch(message) {
  return new Error(
    `Catálogo do Terminal 77 não corresponde à página atual. ${message} ` +
      'Nada deve ser enviado até revisar o bundle público.',
  );
}

function sameList(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every(
      (value, index) => normalizeText(value) === normalizeText(expected[index]),
    )
  );
}

function requireContext(contexts, parser, description) {
  const matches = [];
  for (const context of contexts) {
    try {
      const value = parser(String(context).trim());
      if (value !== null && value !== undefined) matches.push(value);
    } catch {
      // O DOM pode conter mais de um bloco auxiliar. Somente o bloco que passa
      // por toda a validação da questão é aceito.
    }
  }

  if (matches.length === 0) {
    throw mismatch(`Não foi possível validar ${description}.`);
  }

  const serialized = new Set(matches.map((value) => JSON.stringify(value)));
  if (serialized.size !== 1) {
    throw mismatch(`Foram encontrados valores conflitantes para ${description}.`);
  }
  return matches[0];
}

function assertTemplate(actual, expected, description) {
  if (normalizeText(actual) !== normalizeText(expected)) {
    throw mismatch(`A especificação de ${description} foi alterada.`);
  }
}

function solveReverse(contexts) {
  const code = requireContext(
    contexts,
    (context) => {
      const match = context.match(/^agent_code\s*=\s*"([0-9A-F]{12})"$/i);
      if (!match) return null;
      const agentCode = normalizeAgentCode(match[1]);
      assertTemplate(context, `agent_code = "${agentCode}"`, 'reversão');
      return agentCode;
    },
    'o código da questão de reversão',
  );
  return [...code].reverse().join('');
}

function solveBase64(contexts) {
  return requireContext(
    contexts,
    (context) => {
      const payload = context.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      const match = decoded.match(/^T77\|([0-9A-F]{12})$/i);
      if (!match) return null;
      const agentCode = normalizeAgentCode(match[1]);
      const expected = Buffer.from(`T77|${agentCode}`, 'utf8').toString('base64');
      if (payload !== expected) {
        throw mismatch('O payload Base64 não usa o formato esperado.');
      }
      return `T77|${agentCode}`;
    },
    'o payload Base64',
  );
}

function solveJsonRoute(contexts) {
  return requireContext(
    contexts,
    (context) => {
      let document;
      try {
        document = JSON.parse(context);
      } catch {
        return null;
      }

      if (
        !document ||
        typeof document !== 'object' ||
        !sameList(Object.keys(document).sort(), ['fragments', 'route']) ||
        !document.fragments ||
        typeof document.fragments !== 'object' ||
        !sameList(Object.keys(document.fragments).sort(), [
          'alpha',
          'beta',
          'gamma',
        ]) ||
        !Array.isArray(document.route) ||
        !sameList(document.route, ['gamma', 'alpha', 'beta'])
      ) {
        throw mismatch('A estrutura ou a rota JSON foi alterada.');
      }

      const { alpha, beta, gamma } = document.fragments;
      const agentCode = normalizeAgentCode(`${alpha}${beta}${gamma}`);
      if (
        alpha !== agentCode.slice(0, 4) ||
        beta !== agentCode.slice(4, 8) ||
        gamma !== agentCode.slice(8, 12)
      ) {
        throw mismatch('Os fragmentos JSON não representam o código esperado.');
      }
      return `${gamma}${alpha}${beta}`;
    },
    'a estrutura JSON',
  );
}

function sqliteCode(agentCode) {
  const pairs = agentCode.match(/.{2}/g);
  return `WITH packets(agent, bytes) AS (
  VALUES
${pairs.map((pair) => `    ('${agentCode}', 0x${pair})`).join(',\n')},
    ('DECOY', 0x4D),
    ('DECOY', 0x2A)
)
SELECT agent || ':' || SUM(bytes)
FROM packets
WHERE agent = '${agentCode}'
GROUP BY agent;`;
}

function solveSqlite(contexts) {
  const agentCode = requireContext(
    contexts,
    (context) => {
      if (!context.includes('WITH packets(agent, bytes)')) return null;
      const match = context.match(/WHERE\s+agent\s*=\s*'([0-9A-F]{12})'/i);
      if (!match) return null;
      const code = normalizeAgentCode(match[1]);
      assertTemplate(context, sqliteCode(code), 'SQLite');
      return code;
    },
    'a consulta SQLite',
  );
  const sum = agentCode
    .match(/.{2}/g)
    .reduce((total, pair) => total + Number.parseInt(pair, 16), 0);
  return `${agentCode}:${sum}`;
}

function pairTransformCode(agentCode) {
  return `function transform(code) {
  return code.match(/.{2}/g)
    .map((pair, index) =>
      index % 2 === 1 ? [...pair].reverse().join("") : pair
    )
    .reverse()
    .join("-");
}
transform("${agentCode}");`;
}

function solvePairTransform(contexts) {
  const agentCode = requireContext(
    contexts,
    (context) => {
      if (!context.includes('function transform(code)')) return null;
      const match = context.match(/transform\("([0-9A-F]{12})"\);?\s*$/i);
      if (!match) return null;
      const code = normalizeAgentCode(match[1]);
      assertTemplate(context, pairTransformCode(code), 'transformação de pares');
      return code;
    },
    'a função de transformação de pares',
  );
  return agentCode
    .match(/.{2}/g)
    .map((pair, index) =>
      index % 2 === 1 ? [...pair].reverse().join('') : pair,
    )
    .reverse()
    .join('-');
}

function finalTokenCode(agentCode) {
  return `HEX = "0123456789ABCDEF"

para cada caractere do agent_code:
  novo = HEX[(HEX.indexOf(caractere) + índice + 7) % 16]
token = "T77-" + caracteres_transformados
agent_code = "${agentCode}"

exemplo independente: "0000" → "789A"`;
}

function solveFinalToken(contexts) {
  const agentCode = requireContext(
    contexts,
    (context) => {
      if (!context.includes('HEX = "0123456789ABCDEF"')) return null;
      const match = context.match(/agent_code\s*=\s*"([0-9A-F]{12})"/i);
      if (!match) return null;
      const code = normalizeAgentCode(match[1]);
      assertTemplate(context, finalTokenCode(code), 'token final');
      return code;
    },
    'a especificação do token final',
  );
  const transformed = [...agentCode]
    .map(
      (character, index) =>
        HEX[(HEX.indexOf(character) + index + 7) % HEX.length],
    )
    .join('');
  return `T77-${transformed}`;
}

export function answerTerminalQuestion({
  questionNumber,
  question,
  contexts = [],
  options = [],
}) {
  const normalizedQuestion = normalizeText(question);
  const entry = TERMINAL_CATALOG.find(
    (candidate) => normalizeText(candidate.question) === normalizedQuestion,
  );

  if (!entry) {
    throw mismatch(`Enunciado desconhecido: ${JSON.stringify(question)}.`);
  }

  const expectedNumber = TERMINAL_CATALOG.indexOf(entry) + 1;
  if (questionNumber !== expectedNumber) {
    throw mismatch(
      `A questão ${entry.id} apareceu na posição ${questionNumber}; era esperada na posição ${expectedNumber}.`,
    );
  }

  if (entry.kind === 'choice') {
    if (!sameList(options, entry.options)) {
      throw mismatch(`As alternativas da questão ${entry.id} foram alteradas.`);
    }
    return {
      kind: 'choice',
      index: entry.correctAnswer,
      rawAnswer: options[entry.correctAnswer],
      questionId: entry.id,
    };
  }

  if (options.length > 0) {
    throw mismatch(`A questão aberta ${entry.id} passou a exibir alternativas.`);
  }

  const text = entry.solve(contexts);
  return { kind: 'text', text, rawAnswer: text, questionId: entry.id };
}

export async function validateTerminalClientCatalog(page) {
  const signatures = TERMINAL_CATALOG.flatMap(({ id, question }) => [
    `id:${JSON.stringify(id)}`,
    `question:${JSON.stringify(question)}`,
  ]);
  signatures.push(JSON.stringify('tech-terminal-77-v2'));

  const scriptUrls = await page.locator('script[src]').evaluateAll((scripts) =>
    scripts.map((script) => script.src).filter(Boolean),
  );
  const result = await page.evaluate(
    async ({ urls, expectedSignatures }) => {
      const scripts = await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) return null;
            return { url, source: await response.text() };
          } catch {
            return null;
          }
        }),
      );
      const match = scripts.find(
        (script) =>
          script &&
          expectedSignatures.every((signature) =>
            script.source.includes(signature),
          ),
      );
      return match
        ? { url: match.url, bytes: new TextEncoder().encode(match.source).length }
        : null;
    },
    { urls: scriptUrls, expectedSignatures: signatures },
  );

  if (!result) {
    throw mismatch(
      'O bundle carregado não contém as 10 assinaturas conhecidas na versão v2.',
    );
  }
  return result;
}
