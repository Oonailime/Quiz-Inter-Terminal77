import { answerTerminalQuestion } from './terminal-answer.mjs';

const TERMINAL_CARD_SELECTOR = '.tech-question-card';
const TERMINAL_RESULT_SELECTOR = '.tech-result-card';

export async function runTerminalTurbo(page, { maxQuestions = 10 } = {}) {
  for (let answeredCount = 0; answeredCount < maxQuestions; answeredCount += 1) {
    if (await terminalResultIsVisible(page)) return;

    await page.waitForSelector(TERMINAL_CARD_SELECTOR, { state: 'visible' });
    const snapshot = await readQuestionSnapshot(page);
    const startedAt = performance.now();
    const answer = answerTerminalQuestion(snapshot);
    const calculationMs = performance.now() - startedAt;

    console.log(
      `Pergunta ${snapshot.questionNumber}: ${JSON.stringify(answer.rawAnswer)} (${calculationMs.toFixed(3)} ms, turbo local)`,
    );

    const outcome = await submitAndAdvanceInPage(page, {
      answer,
      previousQuestion: snapshot.question,
    });
    if (outcome.kind === 'retry') {
      throw new Error(
        `A resposta turbo da pergunta ${snapshot.questionNumber} foi rejeitada. A automação parou sem usar as outras tentativas: ${outcome.feedback}`,
      );
    }
    if (outcome.kind === 'result') return;
  }

  await page.waitForSelector(TERMINAL_RESULT_SELECTOR, { state: 'visible' });
}

async function terminalResultIsVisible(page) {
  return page
    .locator(TERMINAL_RESULT_SELECTOR)
    .isVisible()
    .catch(() => false);
}

async function readQuestionSnapshot(page) {
  return page.evaluate((cardSelector) => {
    const normalize = (value) => value?.replace(/\s+/g, ' ').trim() || '';
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    };

    const card = document.querySelector(cardSelector);
    if (!card || !isVisible(card)) throw new Error('Cartão da questão ausente.');

    const heading = card.querySelector('h1');
    const question = normalize(heading?.textContent);
    if (!question) throw new Error('Enunciado da questão ausente.');

    const numberMatch = normalize(card.textContent).match(
      /QUEST(?:ÃO|AO)\s+0*(\d+)\s*\/\s*\d+/i,
    );
    if (!numberMatch) throw new Error('Posição da questão ausente.');

    const contexts = [
      ...card.querySelectorAll(
        '.tech-agent-code, .tech-challenge-code, [data-question-context]',
      ),
    ]
      .filter(isVisible)
      .map((element) => element.innerText.trim())
      .filter((value, index, values) => value && values.indexOf(value) === index);

    const options = [...card.querySelectorAll('button.tech-option')]
      .filter(isVisible)
      .map((button) => {
        const strong = button.querySelector('strong');
        return normalize(strong?.textContent || button.textContent);
      });

    return {
      questionNumber: Number(numberMatch[1]),
      question,
      contexts,
      options,
    };
  }, TERMINAL_CARD_SELECTOR);
}

async function submitAndAdvanceInPage(page, { answer, previousQuestion }) {
  return page.evaluate(
    async ({ submittedAnswer, oldQuestion, cardSelector, resultSelector }) => {
      const normalize = (value) => value?.replace(/\s+/g, ' ').trim() || '';
      const normalizeLabel = (value) => normalize(value).toLocaleLowerCase('pt-BR');
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      };
      const isReady = (button) =>
        isVisible(button) &&
        !button.disabled &&
        button.getAttribute('aria-disabled') !== 'true';
      const findReadyButton = (labels) =>
        [...document.querySelectorAll('button')].find((button) => {
          const label = normalizeLabel(button.textContent);
          return isReady(button) && labels.some((item) => label.startsWith(item));
        });
      const waitUntil = (reader, timeoutMs = 15_000) =>
        new Promise((resolve, reject) => {
          const deadline = performance.now() + timeoutMs;
          const check = () => {
            try {
              const value = reader();
              if (value) return resolve(value);
              if (performance.now() >= deadline) {
                return reject(new Error('Tempo esgotado aguardando atualização da página.'));
              }
              setTimeout(check, 0);
            } catch (error) {
              reject(error);
            }
          };
          check();
        });

      const card = document.querySelector(cardSelector);
      if (!card || !isVisible(card)) throw new Error('Cartão da questão ausente.');

      if (submittedAnswer.kind === 'choice') {
        const options = [...card.querySelectorAll('button.tech-option')].filter(
          isVisible,
        );
        const option = options[submittedAnswer.index];
        if (!option) throw new Error('Alternativa calculada não existe no DOM.');
        option.click();
      } else {
        const input = card.querySelector('#tech-challenge-answer');
        if (!input || !isVisible(input)) {
          throw new Error('Campo de resposta aberta ausente.');
        }
        const prototype =
          input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (!valueSetter) throw new Error('Setter nativo do campo indisponível.');
        valueSetter.call(input, submittedAnswer.text);
        input.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            data: submittedAnswer.text,
            inputType: 'insertText',
          }),
        );
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const confirmButton = await waitUntil(() =>
        findReadyButton(['confirmar resposta', 'confirmar', 'responder', 'enviar']),
      );
      confirmButton.click();

      let advanceClicked = false;
      return waitUntil(() => {
        if (isVisible(document.querySelector(resultSelector))) {
          return { kind: 'result' };
        }

        const notice = [...document.querySelectorAll('.tech-attempt-notice')].find(
          isVisible,
        );
        const noticeText = normalize(notice?.textContent);
        if (noticeText) return { kind: 'retry', feedback: noticeText };

        const currentQuestion = normalize(
          document.querySelector(`${cardSelector} h1`)?.textContent,
        );
        if (advanceClicked && currentQuestion && currentQuestion !== oldQuestion) {
          return { kind: 'advance' };
        }

        if (!advanceClicked) {
          const nextButton = findReadyButton([
            'próxima pergunta',
            'proxima pergunta',
            'próximo teste',
            'proximo teste',
            'continuar',
            'ver meu resultado',
            'compilar resultado',
            'resultado',
          ]);
          if (nextButton) {
            advanceClicked = true;
            nextButton.click();
          }
        }
        return null;
      });
    },
    {
      submittedAnswer: answer,
      oldQuestion: previousQuestion,
      cardSelector: TERMINAL_CARD_SELECTOR,
      resultSelector: TERMINAL_RESULT_SELECTOR,
    },
  );
}
