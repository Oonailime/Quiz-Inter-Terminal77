# Como o RPA do Terminal 77 funciona

## Objetivo

O Terminal 77 combinava quatro questões de múltipla escolha com seis desafios
personalizados por um código hexadecimal de agente. Além de acertar, era
necessário reduzir o tempo total de uma sequência estritamente ordenada:
ler, responder, confirmar, aguardar a validação e avançar.

A solução final separou o problema em três partes:

- validação preventiva do conteúdo carregado;
- resolução determinística e local;
- automação de baixa latência no DOM.

Essa versão obteve 3.000/3.000 pontos em aproximadamente 1 segundo e terminou
em primeiro lugar.

## Arquitetura

```text
run-terminal.mjs
        |
        v
terminal-rpa.mjs --------> autenticação, pré-voo e resultado
        |
        +--> terminal-answer.mjs ---> catálogo, validações e cálculos
        |
        +--> terminal-turbo.mjs ----> leitura, envio e avanço no DOM
```

O arquivo [run-terminal.mjs](../run-terminal.mjs) define os padrões da execução
final. O [terminal-rpa.mjs](../terminal-rpa.mjs) abre o navegador, conduz a
autenticação, valida a página e orquestra o desafio. A lógica das respostas fica
isolada em [terminal-answer.mjs](../terminal-answer.mjs), enquanto
[terminal-turbo.mjs](../terminal-turbo.mjs) cuida apenas do caminho crítico no
navegador.

Essa separação permite testar os cálculos sem acessar o site e simular o fluxo
completo em uma página local.

## 1. Autenticação e sessão local

O navegador usa um contexto persistente em `.browser-profile`. Se não houver
uma sessão válida, o RPA abre a autenticação do Inter e salva duas imagens:

- `terminal-77-qrcode.png`, com a página completa;
- `terminal-77-qrcode-only.png`, com o melhor candidato quadrado encontrado.

Enquanto aguarda a leitura, o QR é atualizado no intervalo configurado. Após o
retorno ao Terminal 77, os cookies ficam no perfil local para que execuções
seguintes não repitam a autenticação.

O perfil e as capturas estão no `.gitignore`, pois podem conter informações de
sessão ou dados temporários de autenticação.

## 2. Pré-voo antes do cronômetro

Iniciar sem saber se a página mudou colocaria a tentativa em risco. Por isso,
`validateTerminalClientCatalog` busca nos scripts carregados:

- o identificador `tech-terminal-77-v2`;
- os dez IDs das questões;
- os dez enunciados esperados.

A execução só continua quando todas as assinaturas aparecem no mesmo bundle.
Depois disso, o RPA também aguarda o carregamento inicial do ranking, aproveitando
para aquecer a conexão usada pela aplicação antes do início da tentativa.

Se qualquer assinatura estiver ausente, o comportamento é *fail fast*: nada é
enviado e o usuário precisa revisar a nova versão.

## 3. Resolvedor local

O catálogo descreve tipo, posição, enunciado e, nas questões objetivas, a ordem
exata das alternativas. O resolvedor não usa somente o número da pergunta: cada
entrada precisa corresponder ao conteúdo visível.

As quatro primeiras questões selecionam o índice conhecido depois de validar a
lista completa de alternativas. As seis abertas executam cálculos locais:

| Questão | Operação |
| --- | --- |
| 5 | Inverte os 12 caracteres do código de agente |
| 6 | Decodifica Base64 e valida o formato `T77\|<código>` |
| 7 | Percorre uma rota JSON e concatena seus fragmentos |
| 8 | Reproduz a soma de seis bytes de uma consulta SQLite |
| 9 | Transforma pares alternados e inverte sua ordem |
| 10 | Desloca cada hexadecimal e monta o token final |

Além do resultado, cada função confere a estrutura do bloco recebido. Uma
consulta SQLite com linhas extras, uma rota JSON diferente ou uma constante
alterada é rejeitada, mesmo que seja possível produzir algum valor.

O catálogo observado durante o desafio está documentado em
[terminal-77-perguntas.md](../terminal-77-perguntas.md).

## 4. Caminho turbo

Uma implementação Playwright tradicional alternaria diversas vezes entre o
processo Node.js e o Chromium para cada questão. Esse custo seria pequeno
isoladamente, mas relevante em dez ciclos sequenciais.

O modo turbo mantém os cálculos no Node.js, porém agrupa no contexto da página:

1. preenchimento da resposta;
2. disparo dos eventos nativos do campo;
3. clique em **CONFIRMAR**;
4. espera pelo resultado, aviso de rejeição ou botão de avanço;
5. clique no próximo passo.

A espera usa verificações curtas e começa assim que o DOM muda. Não há atrasos
artificiais entre as ações.

Para perguntas abertas, o valor é aplicado pelo setter nativo de `input` ou
`textarea`, seguido dos eventos `input` e `change`. Isso atualiza corretamente o
estado controlado pela aplicação antes do clique.

## 5. Proteções durante a tentativa

O RPA interrompe a execução quando encontra qualquer uma destas condições:

- enunciado, posição ou alternativas diferentes do catálogo;
- estrutura inesperada em uma questão aberta;
- campo, botão ou cartão obrigatório ausente;
- resposta recusada pelo validador;
- pontuação final diferente de 3.000;
- tempo limite de navegação ou autenticação.

Nas questões abertas, uma rejeição encerra o fluxo imediatamente, preservando
as tentativas restantes. Em caso de erro, `quiz-error.png` registra o estado da
página para diagnóstico e permanece fora do Git.

## 6. Testes e benchmark

[test/terminal-answer.test.mjs](../test/terminal-answer.test.mjs) cobre as dez
respostas e cenários de recusa, como mudança de alternativa, especificação ou
posição.

[test/terminal-turbo.test.mjs](../test/terminal-turbo.test.mjs) monta no
Chromium uma versão local do fluxo. A página simulada só habilita **CONFIRMAR**
depois que os eventos corretos ocorrem e só libera a próxima questão quando o
valor enviado coincide com o esperado.

Para executar:

```bash
npm run check
npm test
npm run benchmark:terminal
```

O benchmark primeiro valida os dez casos e só então repete a resolução. Como
ele não abre o site, pode ser usado sem autenticação e sem consumir tentativa.

## 7. Execução operacional

A inspeção autentica, valida o catálogo e registra os elementos visíveis, mas
não inicia o desafio:

```bash
npm run terminal:inspect
```

A execução final exige o identificador do Fórum:

```bash
FORUM_HANDLE=@seu.usuario npm run terminal:run
```

O projeto é deliberadamente específico para a versão observada no evento. Essa
restrição faz parte da segurança da automação: diante de uma mudança, parar é
mais correto do que continuar com suposições antigas.

## Principais aprendizados técnicos

- otimização relevante começa pela medição do caminho crítico;
- validações fortes são tão importantes quanto a automação feliz;
- separar leitura, decisão e atuação melhora testes e manutenção;
- eliminar chamadas externas do trecho cronometrado reduz latência e variação;
- eventos e setters nativos são essenciais ao automatizar interfaces com estado
  controlado;
- artefatos de autenticação e perfis de navegador exigem cuidado especial antes
  de publicar um repositório.
