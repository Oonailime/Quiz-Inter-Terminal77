# RPA do Quiz do Inter — Terminal 77

Automação desenvolvida para o desafio **Terminal 77**, do Banco Inter. A
A solução final concluiu as 10 questões em aproximadamente **1 segundo**, obteve
**3.000/3.000 pontos** e alcançou o **1º lugar**.

Este repositório contém somente o caminho que produziu esse resultado: um RPA
em Node.js e Playwright, com resolução local e execução otimizada no navegador.

## Como a solução funciona

O RPA autentica a conta por QR Code, valida se a versão e as dez questões da
página ainda correspondem ao catálogo conhecido e só então inicia a tentativa.
Durante o desafio, ele:

1. lê o enunciado, a posição, as alternativas e o bloco de contexto;
2. valida o conteúdo para evitar responder a uma versão diferente;
3. resolve cada questão localmente;
4. preenche, confirma e avança pelo DOM da própria página;
5. interrompe imediatamente se detectar uma alteração ou resposta rejeitada.

As quatro primeiras respostas vêm de um catálogo validado. As seis seguintes
são calculadas em tempo de execução: reversão de string, Base64, navegação em
JSON, soma de bytes, transformação de pares e geração de token hexadecimal.

O fluxo de alta velocidade reduz as idas e voltas entre Node.js e Chromium ao
executar a sequência crítica dentro da página. Mais detalhes estão em
[Como o RPA funciona](docs/COMO-O-RPA-FUNCIONA.md).

## Tecnologias

- Node.js 20 ou superior;
- Playwright;
- Chromium;
- testes nativos do Node.js (`node:test`).

## Instalação

```bash
npm ci
```

No Ubuntu 24.04 amd64 via WSL, o projeto inclui uma preparação sem `sudo` que
instala o Chromium e extrai localmente as bibliotecas necessárias:

```bash
npm run setup:wsl
```

Em outros ambientes Linux, use a instalação recomendada pelo Playwright para a
sua distribuição.

## Validação local

Verifique a sintaxe, execute os testes e valide as dez respostas sem acessar o
site:

```bash
npm run check
npm test
npm run benchmark:terminal
```

O teste do modo turbo cria uma página simulada no Chromium e percorre as dez
questões de ponta a ponta. O benchmark mede somente o resolvedor local e não
consome tentativa no desafio.

## Inspeção segura

Para autenticar e conferir o DOM sem clicar em **EXECUTAR**:

```bash
npm run terminal:inspect
```

O QR Code é atualizado periodicamente e salvo em
`terminal-77-qrcode-only.png`; uma captura completa também é gerada para
diagnóstico. Esses arquivos e o perfil persistente do navegador são locais e
estão ignorados pelo Git.

## Execução

Informe o identificador usado no Fórum Inter e execute:

```bash
FORUM_HANDLE=@seu.usuario npm run terminal:run
```

O comando reutiliza `.browser-profile`, valida o catálogo público antes de
iniciar e executa somente o resolvedor local. Para exigir uma confirmação por
Enter imediatamente antes do início:

```bash
FORUM_HANDLE=@seu.usuario PAUSE_BEFORE_START=1 npm run terminal:run
```

> O código foi criado para a versão `tech-terminal-77-v2` disponível durante o
> desafio. Se a página ou o catálogo mudar, a validação preventiva encerrará a
> execução.

## Configuração

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `FORUM_HANDLE` | — | Identificador obrigatório na execução real |
| `HEADLESS` | `1` | Use `0` para exibir o navegador |
| `USER_DATA_DIR` | `.browser-profile` | Perfil persistente usado na autenticação |
| `PAUSE_BEFORE_START` | `0` | Aguarda Enter antes de iniciar |
| `AUTH_TIMEOUT_MS` | `600000` | Limite para concluir a autenticação |
| `QR_CAPTURE_INTERVAL_MS` | `30000` | Intervalo entre capturas do QR Code |
| `MAX_QUESTIONS` | `10` | Limite de questões da execução |
| `KEEP_OPEN_MS` | `0` | Tempo para manter o navegador aberto ao final |
| `SLOW_MO_MS` | `0` | Atraso de depuração entre ações do Playwright |

## Estrutura

```text
run-terminal.mjs          configura a execução final
terminal-rpa.mjs          autentica, valida e orquestra o navegador
terminal-answer.mjs       valida o catálogo e calcula as respostas
terminal-turbo.mjs        percorre as questões com baixa latência
inspect-terminal.mjs      inspeciona a página sem iniciar a tentativa
benchmark-terminal.mjs    valida e mede o resolvedor offline
test/                     testes unitários e teste de integração no DOM
scripts/                  preparação do Chromium no WSL
docs/                     documentação técnica
```

