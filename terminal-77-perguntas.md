# Terminal 77 — catálogo das 10 perguntas

Extraído do bundle público atual de `https://aquinointer.tech/terminal-77` em
2026-08-07. A página monta 10 perguntas: as quatro primeiras são fixas e as
seis últimas usam o `agent_code` de 12 caracteres recebido após a autenticação.

> Importante: nas perguntas personalizadas, `AGENT_CODE` representa o código
> real da sessão, normalizado em maiúsculas. O texto das perguntas e as regras
> abaixo estão no JavaScript público, mas o valor concreto só existe depois do
> login.

## 1. Shell — `shell-path`

**Tipo:** alternativa

**Pergunta:** Depois destes comandos, qual caminho o terminal exibirá?

```console
$ pwd
/home/aluno/projetos
$ cd ../logs
$ pwd
```

Alternativas:

1. `/home/aluno/projetos/logs`
2. `/home/aluno/logs`
3. `/home/logs`
4. `/logs`

**Resposta:** `/home/aluno/logs` (alternativa 2).

## 2. Web — `http-session-created`

**Tipo:** alternativa

**Pergunta:** O que este registro confirma sobre a requisição?

```text
POST /sessions → 201
```

Alternativas:

1. A requisição foi redirecionada.
2. Um recurso de sessão foi criado.
3. A resposta necessariamente não possui corpo.
4. A autenticação foi recusada.

**Resposta:** Um recurso de sessão foi criado (alternativa 2).

## 3. Git — `git-switch-branch`

**Tipo:** alternativa

**Pergunta:** Qual comando cria a branch `pista-77` e já muda para ela?

```console
$ git status
On branch main
```

Alternativas:

1. `git branch pista-77`
2. `git switch pista-77`
3. `git switch -c pista-77`
4. `git checkout pista-77 --create`

**Resposta:** `git switch -c pista-77` (alternativa 3).

## 4. JavaScript — `javascript-pipeline`

**Tipo:** alternativa

**Pergunta:** Qual valor será impresso por este pipeline?

```javascript
const packets = [3, 7, 10, 12];
const total = packets
  .filter((n) => n % 2 === 0)
  .reduce((sum, n) => sum + n, 0);
console.log(total);
```

Alternativas: `10`, `15`, `19`, `22`.

**Resposta:** `22` (alternativa 4).

## 5. Manipulação de texto — `reverse-agent-code`

**Tipo:** texto, até 3 tentativas

**Pergunta:** Inverta os 12 caracteres do seu código de agente, sem adicionar
separadores.

```text
agent_code = "AGENT_CODE"
```

**Regra da resposta:** inverter todos os caracteres do código.

Exemplo: `A1B2C3D4E5F6` → `6F5E4D3C2B1A`.

## 6. Encoding — `base64-agent-payload`

**Tipo:** texto, até 3 tentativas

**Pergunta:** Decodifique o payload Base64 e informe exatamente o conteúdo
encontrado.

O payload mostrado na tela é gerado assim:

```javascript
btoa(`T77|${AGENT_CODE}`)
```

**Regra da resposta:** `T77|AGENT_CODE`.

Exemplo: para `A1B2C3D4E5F6`, a resposta é `T77|A1B2C3D4E5F6`.

## 7. JSON — `json-fragment-route`

**Tipo:** texto, até 3 tentativas

**Pergunta:** Siga `route` e concatene os fragmentos correspondentes, sem
separadores.

```json
{
  "fragments": {
    "alpha": "os 4 primeiros caracteres",
    "beta": "os 4 caracteres centrais",
    "gamma": "os 4 últimos caracteres"
  },
  "route": ["gamma", "alpha", "beta"]
}
```

**Regra da resposta:** últimos 4 + primeiros 4 + 4 centrais.

Exemplo: `A1B2C3D4E5F6` → `E5F6A1B2C3D4`.

## 8. SQLite — `sqlite-agent-packets`

**Tipo:** texto, até 3 tentativas

**Pergunta:** Execute ou calcule esta consulta SQLite e informe a única linha
retornada.

```sql
WITH packets(agent, bytes) AS (
  VALUES
    ('AGENT_CODE', 0xP1),
    ('AGENT_CODE', 0xP2),
    ('AGENT_CODE', 0xP3),
    ('AGENT_CODE', 0xP4),
    ('AGENT_CODE', 0xP5),
    ('AGENT_CODE', 0xP6),
    ('DECOY', 0x4D),
    ('DECOY', 0x2A)
)
SELECT agent || ':' || SUM(bytes)
FROM packets
WHERE agent = 'AGENT_CODE'
GROUP BY agent;
```

`P1` a `P6` são os seis pares hexadecimais do código.

**Regra da resposta:** `AGENT_CODE:SOMA`, em que `SOMA` é a soma decimal dos
seis pares interpretados como bytes hexadecimais. As linhas `DECOY` são
ignoradas pelo `WHERE`.

Exemplo: `A1B2C3D4E5F6` → `A1B2C3D4E5F6:1221`.

## 9. Algoritmos — `pair-transform`

**Tipo:** texto, até 3 tentativas

**Pergunta:** Qual string a função retorna quando recebe seu código de agente?

```javascript
function transform(code) {
  return code.match(/.{2}/g)
    .map((pair, index) =>
      index % 2 === 1 ? [...pair].reverse().join("") : pair
    )
    .reverse()
    .join("-");
}
transform("AGENT_CODE");
```

**Regra da resposta:** separar o código em seis pares; inverter os caracteres
dos pares de índices 1, 3 e 5; inverter a ordem dos seis pares; unir com `-`.

Exemplo: `A1B2C3D4E5F6` → `6F-E5-4D-C3-2B-A1`.

## 10. Implementação — `final-agent-token`

**Tipo:** texto, até 3 tentativas

**Pergunta:** Implemente a transformação em qualquer linguagem e informe o
token final.

```text
HEX = "0123456789ABCDEF"
para cada caractere do agent_code:
  novo = HEX[(HEX.indexOf(caractere) + índice + 7) % 16]
token = "T77-" + caracteres_transformados
agent_code = "AGENT_CODE"
exemplo independente: "0000" → "789A"
```

**Regra da resposta:** para cada dígito hexadecimal, somar `índice + 7` ao seu
valor e aplicar módulo 16; juntar o prefixo `T77-` ao resultado.

Exemplo: `A1B2C3D4E5F6` → `T77-194C7FA2D508`.

## Resumo para a automação

- Perguntas 1–4: alternativas fixas.
- Perguntas 5–10: entrada de texto calculada com o `agent_code` da sessão.
- O bloco de código/especificação faz parte do enunciado e precisa ser enviado
  junto com a pergunta ao resolvedor.
- As perguntas de texto permitem três tentativas no bundle atual.
- O conteúdo pode ser alterado pelo organizador; valide novamente o bundle
  imediatamente antes da tentativa oficial.
