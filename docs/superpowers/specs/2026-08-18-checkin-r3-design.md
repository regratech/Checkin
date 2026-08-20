# Check-in R3 — Design

Data: 2026-08-18

Sistema de check-in pré-evento para os treinamentos da Regra 3. Substitui o par
Typebot + Google Sheets usado hoje.

---

## 1. Problema

O check-in atual é um fluxo Typebot ("Lara") que lê uma planilha do Google e
grava numa tabela larga. Três defeitos estruturais:

**Duplicação do fluxo.** O `Group #6` ramifica em `numero_insc = 1 | 2 | 3 | 4`
e cada ramo é uma cópia quase idêntica dos outros. Editar uma pergunta custa
quatro edições. Não existe caminho para um quinto acompanhante.

**Duplicação das colunas.** Como consequência, a planilha repete o mesmo grupo
de seis campos quatro vezes: `participante N_nome`, `participante N_email`,
`participante N_tel`, `participante N_niver`, `participante N_crachá`,
`cargo participante N`. Vinte e quatro colunas para uma entidade. Metade fica
vazia sempre. Não é possível ordenar por nome nem filtrar por cargo — não
existe *uma* coluna de nome.

**Identificação frágil.** O participante digita o email e o fluxo compara
literalmente contra a planilha (`IF email_insc = email_informado`), depois de
pedir "digite tudo em minúsculo e exatamente como colocou na inscrição". Quem
erra cai em `Group #5`: "Hum, não encontramos o e-mail." Maiúscula, espaço no
fim ou compra com outro email prendem a pessoa num loop.

Além disso: os checkboxes `1 insc - mesmos dados` / `2 insc` / `3 insc` são um
contador preenchido à mão, que desalinha da realidade; e `email_informado`
disputa com `email_insc` o papel de identidade.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Momento | Check-in é **pré-evento**. Presença na portaria fica fora do escopo v1. |
| Origem dos dados | Guru, por adaptador com três portas: webhook, API ou CSV. A definir qual — o desenho aceita as três. |
| Acesso | **Link único por inscrição, com token.** Sem senha, sem digitar email. |
| Quem preenche | O titular preenche tudo, inclusive os acompanhantes. |
| Formulário | Núcleo de campos fixos + perguntas customizáveis por evento. |
| Interface | **Chat**, uma pergunta por vez, mantendo a Lara. |
| Revisão de dado pré-existente | Só o titular. Acompanhantes são coleta em branco. |
| Pessoa repetida entre eventos | Liga em silêncio à ficha existente; o dado válido do evento é o digitado agora. |
| Chave de identidade | `email + nome normalizado`. Email sozinho funde pessoas — mais da metade dos acompanhantes reusa o email do titular. |
| Filtro de grupo | Abas por `vagas` (o que foi comprado), não por preenchidos. |
| Stack | Projeto novo, Next.js 16 + Supabase + Tailwind + zod + vitest. Migrations numeradas, aplicadas à mão pelo SQL Editor. Nomes em português. |

## 3. Modelo de dados

O princípio: **o que se repete vira linha, não coluna.**

A linha achatada de hoje contém quatro entidades distintas:

| No modelo atual | O que é | Cardinalidade |
|---|---|---|
| `email_informado`, `nome_insc`, `email_insc`, `tel_insc`, `numero_insc` | a compra | 1 por transação |
| `nome do buffet`, `cidade`, `instagram_buffet`, `faturamento`, notas | a empresa e o diagnóstico | 1 por compra |
| `participante N_*`, `cargo participante N` | as pessoas | 1 a 4 por compra |
| `N insc - mesmos dados` | uma contagem | — |

### 3.1 Relacionamentos

```
eventos ──┬── inscricoes ──┬── participantes ──→ pessoas
          │   (a compra)   │   (quem vem, com     (identidade,
          │                │    os dados do        global entre
          │                │    evento)            eventos)
          │                │
          │                └── respostas ─┐
          ├── perguntas ──────────────────┘
          └── sincronizacoes
```

### 3.2 Tabelas

**`eventos`** — a "pasta". Todo o resto carrega `evento_id`; é isso que dá o
isolamento entre eventos.

    id, nome, slug (único), prefixo_codigo, data, local, ativo, criado_em

`prefixo_codigo` (ex.: `ENG26`) alimenta o código legível das inscrições.

**`pessoas`** — a espinha de identidade, **global, fora do evento**.

    id, email (normalizado), nome_chave (normalizado), nome_recente,
    criado_em, atualizado_em
    único (email, nome_chave)

A chave é **o par email + nome normalizado**, não o email sozinho. Motivo, medido
na planilha do último evento: em 7 dos 13 grupos o acompanhante foi cadastrado
com o email do titular (Leonardo Guerrieri sob `laguerryeventos@gmail.com`,
Marciane Rodrigues sob `reginamorais@hotmail.com`, e mais cinco). Email único
fundiria dois seres humanos numa ficha só. O telefone não resolve: Marciane,
Roberta e Ligia também repetem o telefone do titular.

Normalização: email em minúsculas sem espaços nas pontas; `nome_chave` sem
acentos, minúsculo, espaços colapsados.

O custo assumido é o oposto: "Regina De Morais Pereira" num evento e "Regina
Morais" no outro geram duas fichas. **Duplicar é reversível; fundir dois humanos
não é** — o desenho erra para o lado seguro.

`nome_recente` existe só para busca e telas de histórico. **Não é fonte de
verdade** — o nome que vale em cada evento está em `participantes`.

**`inscricoes`** — a compra. Uma linha por transação.

    id, evento_id, codigo (único por evento), pessoa_titular_id, origem,
    guru_transacao_id (único), guru_payload jsonb, email_compra, nome_compra,
    telefone_compra, valor, status_pagamento, vagas, empresa_nome,
    empresa_cidade, empresa_instagram, token (único), status_checkin,
    passo_atual, concluido_em, criado_em

- `codigo` é o identificador legível, sequencial por evento: `ENG26-0042`.
- `email_compra` guarda o que o Guru mandou e nunca muda (é o `email_informado`
  de hoje). Contato válido vem de `participantes`.
- `vagas` substitui os checkboxes `N insc - mesmos dados`. É o `numero_insc`.
- `token` é o link sem senha.
- `status_checkin`: `pendente | em_andamento | concluido`.
- `passo_atual` guarda onde a conversa parou, para retomada.

**`participantes`** — quem vem, com **os dados como foram digitados naquele
evento**. Uma linha por pessoa por compra. É aqui que morre o bloco de 24
colunas.

    id, inscricao_id, pessoa_id, ordem (1..N), titular bool,
    nome, email, telefone, data_nascimento, nome_cracha, cargo, criado_em
    único (inscricao_id, ordem)

O código do participante é derivado: `inscricoes.codigo || '-' || ordem`, ex.
`ENG26-0042-2`.

O snapshot é deliberado: como acompanhantes são sempre coletados em branco, o
dado do evento é o que foi digitado agora. `pessoas` liga as participações sem
arriscar que um nome digitado pela metade sobrescreva um registro bom.

**`perguntas`** — o roteiro editável.

    id, evento_id, chave, rotulo, texto_chat, tipo, escopo, obrigatoria,
    ordem, opcoes jsonb, ajuda, ativa
    único (evento_id, chave)

- `chave` é o identificador estável (código, exportação). `rotulo` é o cabeçalho
  da coluna. `texto_chat` é como a Lara pergunta. Renomear o rótulo não quebra
  nada.
- `tipo`: `texto_curto | texto_longo | email | telefone | numero | data |
  selecao_unica | selecao_multipla | nota_estrela | sim_nao`
- `escopo`: `inscricao` (respondida uma vez — faturamento, notas, CRM) ou
  `participante` (respondida por pessoa — cargo, crachá). É o campo que faz o
  roteiro saber o que repetir.

**`respostas`** — o valor.

    id, pergunta_id, escopo, inscricao_id, participante_id, valor jsonb,
    respondido_em
    único (pergunta_id, inscricao_id, participante_id)

`participante_id` é nulo quando `escopo = 'inscricao'`. Garantido por FK
composta `(pergunta_id, escopo) → perguntas(id, escopo)` mais
`check (escopo = 'participante') = (participante_id is not null)`. O banco
recusa resposta no escopo errado.

**`sincronizacoes`** — a caixa de entrada do Guru, substituindo a planilha.

    id, evento_id, origem (webhook | api | csv), recebido_em, payload jsonb,
    status, erro, inscricao_id

Webhook, API e CSV escrevem aqui primeiro, cru. Uma função promove para
`inscricoes`, idempotente por `guru_transacao_id`. Duas vantagens sobre a
planilha: o payload original fica guardado para auditoria, e o Guru reenviando
o mesmo evento não duplica inscrição.

### 3.3 A view da tabela geral

    create view vw_participantes as
    select p.*,
           i.evento_id, i.codigo, i.vagas, i.empresa_nome, i.empresa_cidade,
           i.status_checkin,
           i.codigo || '-' || p.ordem as codigo_participante,
           count(*) over (partition by p.inscricao_id) as pessoas_preenchidas
    from participantes p
    join inscricoes i on i.id = p.inscricao_id;

`pessoas_preenchidas` é **contado do banco**, nunca digitado. É a diferença
central para os checkboxes de hoje, que dependem de alguém marcar certo.

### 3.4 De-para com a planilha arrumada do último evento

A planilha que a operação monta à mão depois de cada evento já tem o formato
correto — uma linha por participante, grupos em sequência, dados do buffet
repetidos em cada linha do grupo. É exatamente o que `vw_participantes` produz
pelo `join`. O sistema automatiza um trabalho manual que hoje existe, não muda
o formato de saída.

| Coluna da planilha | Destino | Escopo |
|---|---|---|
| `id cliente` | `codigo` + `ordem`, derivado | — |
| `Email Informado` | `inscricoes.email_compra` | inscrição |
| `Inscrito Nome` | `participantes.nome` | participante |
| `Inscrito Email` | `participantes.email` | participante |
| `Inscrito Tel` | `participantes.telefone` | participante |
| `Participante Aniversario` | `participantes.data_nascimento` | participante |
| `Participante Cracha` | `participantes.nome_cracha` | participante |
| `Participante Cargo` | pergunta · `selecao_unica` | participante |
| `Nome Buffet` | `inscricoes.empresa_nome` | inscrição |
| `Cidade Buffet` | `inscricoes.empresa_cidade` | inscrição |
| `Instagram Buffet` | `inscricoes.empresa_instagram` | inscrição |
| `Tempo Buffet` | pergunta · `numero` (anos) | inscrição |
| `Media Publico` | pergunta · `selecao_unica` | inscrição |
| `Pessoas Atend Evento` | pergunta · `numero` | inscrição |
| `Faz +1 Evento Dia` | pergunta · `sim_nao` | inscrição |
| `Tipos Eventos` | pergunta · `selecao_multipla` | inscrição |
| `Tipos Servico` | pergunta · `selecao_multipla` | inscrição |
| `Primeiro Atend` … `Montagem Mesa` (7 colunas) | perguntas · `nota_estrela` 0–5 | inscrição |
| `Expectativa` | pergunta · `texto_longo` | inscrição |

Os três `Inscrito *` estão mal rotulados na planilha: contêm o dado do
**participante**, não do titular — a linha `laguerry_p2` traz "Leonardo
Guerrieri" em `Inscrito Nome`. É resíduo do modelo achatado. No modelo novo
`participantes.nome` e `inscricoes.nome_compra` são campos distintos e
nomeados como tal.

### 3.5 Sujeira que as perguntas tipadas eliminam

Amostras reais do último evento, todas causadas por coleta em texto livre:

- **Aniversário** — `5101978`, `25091980`, `21/04/1973`, `28 071964`,
  `24021996`, `00/00/0000`. Seis formatos numa coluna. Tipo `data` com máscara.
- **Tempo de buffet** — `12 anos`, `5 Anos`, `Aproximadamente 4 anos`. Tipo
  `numero`, para ordenar e segmentar por maturidade.
- **Pessoas atendidas por evento** — `300 pss`, `500`, `15000`. Tipo `numero`;
  o outlier fica visível em vez de passar batido.
- **Cargo** — o roteiro atual pergunta em voz diferente para titular e
  acompanhante, então cada papel virou duas strings ("Eu que planejo, organizo,
  coordeno e faço a comida." / "Planeja, organiza, coordena e faz a comida.").
  Quatro papéis reais viraram oito valores e o agrupamento por cargo é
  impossível. Solução: `opcoes` guarda `{chave, rotulo_titular,
  rotulo_acompanhante}` — um valor filtrável, dois textos de exibição.
- **`Tipos Eventos` / `Tipos Servico`** — hoje string com vírgulas, o que impede
  contar quantos atendem casamento. Como `selecao_multipla` em jsonb, viram
  agregação.

### 3.6 Fora do escopo v1

- **Tabela `empresas` global.** Um buffet em 3 eventos gera 3 valores de
  `empresa_nome`. O histórico que importa (a pessoa) já existe via `pessoas`, e
  faturamento muda a cada edição. Normalizável depois sem migração destrutiva.
- **Presença na portaria e QR code.** Cabe um `presente_em` em `participantes`
  depois, sem reestruturar.
- **Filtros salvos e painel de filtros avançados.** As abas por tamanho de grupo
  resolvem o caso real.

## 4. O motor de roteiro

Substitui os quatro ramos duplicados do Typebot por um roteiro único, expandido
em tempo de execução:

    perguntas do evento (ordenadas, com escopo)  +  inscricao.vagas
                              ↓
                      ROTEIRO EXPANDIDO
       1. abertura
       2. confirmação do titular            (participante 1)
       3. perguntas escopo=participante     (participante 1)
       4. dados do participante 2
       5. perguntas escopo=participante     (participante 2)
       ...                                   (repete até vagas)
       n. buffet + perguntas escopo=inscricao
       n+1. revisão → concluir

Cada passo é `{chave, alvo, pergunta_id, tipo}`. Uma pergunta adicionada no
admin aparece para todos os acompanhantes de todas as inscrições. `vagas = 5`
não exige tocar em nada.

## 5. A conversa

**Entrada.** A pessoa clica o link com token e já está identificada — a etapa de
digitar email deixa de existir.

> Oi, Marina! Você garantiu **3 vagas** na Engrenagem. Vou precisar dos dados de
> cada pessoa — leva uns 4 minutos.

Token inexistente ou evento fechado cai numa tela clara com contato de suporte,
não num loop de "tente de novo".

**Passo 1 — titular.** Único momento com dado pré-existente (veio do Guru):

> Começando por você. Confere se está certo:
> Marina Souza · marina@buffetx.com.br · (11) 9xxxx-xxxx
> `[Está certo] [Quero corrigir]`

Um toque resolve o que hoje são quatro perguntas. É o `1 insc - mesmos dados`
virado em confirmação.

**Passos 2..N — acompanhantes.** Coleta em branco, sem pré-preenchimento e sem
confirmação. Nome, email, telefone, aniversário, crachá, cargo, mais as
perguntas de escopo `participante`. Um contador fixo no topo — "pessoa 2 de 3" —
impede a sensação de conversa infinita.

**Passo N+1 — buffet e diagnóstico.** As perguntas de escopo `inscricao`: nome,
cidade, Instagram, faturamento e as notas de auto-avaliação.

**Revisão final.** Resumo de tudo, cada bloco tocável para editar. Resolve a
fraqueza estrutural do chat — voltar atrás sem refazer a conversa.

**Retomada.** Cada resposta é gravada na hora e `passo_atual` guarda a posição.
Voltando pelo mesmo link dias depois:

> Que bom te ver de volta! Você parou na pessoa 2. Continuamos?

Hoje isso é recomeçar do zero.

## 6. Admin

Seletor de evento no topo — as "pastas". Quatro abas, tudo filtrado por
`evento_id`:

| Aba | Função |
|---|---|
| **Participantes** | A tabela geral e as visões por tamanho de grupo |
| **Inscrições** | Uma linha por compra: quem pagou, quantas vagas, o que falta |
| **Roteiro** | Editor de perguntas: rótulo, texto de chat, tipo, escopo, ordem, obrigatória. Arrastar para reordenar |
| **Integração** | Sincronizações do Guru: o que entrou, o que falhou, importar CSV, criar inscrição à mão |

### 6.1 A troca de visão por tamanho de grupo

Não existe painel de filtros. Existe uma fileira de abas que **troca a tabela**:

```
[ Geral ]  [ 1 pessoa ]  [ 2 pessoas ]  [ 3 pessoas ]  [ 4+ pessoas ]
   187          64            48            51             24
```

O número que define a aba é **`inscricoes.vagas`** — o que foi comprado no
Guru. Não `pessoas_preenchidas`. Motivo: `vagas` é estável desde o instante da
compra, enquanto a contagem de preenchidos muda durante a conversa e faria as
linhas pularem de aba enquanto o titular digita.

As abas de 1 a 3 são `vagas = n` exatos; a aba `4+` é `vagas >= 4`, para que
nenhuma inscrição fique sem visão caso o Guru passe a vender lotes maiores.

**Geral** — tabela consolidada, uma linha por pessoa, sem agrupamento:

    Código · Nome · Email · Telefone · Papel · Crachá · Cargo · Buffet ·
    Vagas · Status

**Abas de tamanho** — só os participantes das inscrições daquele `vagas`,
agrupados pelo código, com um cabeçalho por inscrição:

    ▸ ENG26-0042 · Buffet X · São Paulo · 3/3 preenchidos
        ENG26-0042-1   Marina Souza   Sócia       crachá "Marina"
        ENG26-0042-2   João Lima      Comercial   crachá "João"
        ENG26-0042-3   Ana Prado      Eventos     crachá "Ana"

    ▸ ENG26-0051 · Buffet Y · Campinas · 2/3 preenchidos   ⚠
        ENG26-0051-1   Carla Reis     Sócia       crachá "Carla"
        ENG26-0051-2   Pedro Nunes    Cozinha     crachá "Pedro"

`n/vagas preenchidos` compara `pessoas_preenchidas` com `vagas`. Quando
divergem, o alerta aparece — é assim que se enxerga quem comprou 3 e cadastrou
2, hoje invisível.

Complementos em todas as visões: busca livre (nome, email, telefone, buffet,
código), colunas dinâmicas das perguntas do evento com seletor do que exibir, e
chips de status (`Pendente · Em andamento · Concluído`).

**Exportar CSV** respeita a visão ativa e carrega o código. É daí que sai a
lista de crachás e a lista de presença que a Lara promete na abertura.

## 7. Segurança

- RLS em todas as tabelas, como no Engrenagem.
- O participante nunca lê tabela: as rotas de servidor resolvem o token e
  devolvem só o que aquele passo precisa.
- `token` é aleatório e longo; conhecer um não dá acesso a outro. O `codigo`
  legível é público-interno e **não** serve como credencial.
- O admin lê pelo papel `admin`, verificado no servidor.
- A `service_role` só existe em rotas de servidor, nunca no navegador.

## 8. Testes

- Promoção de `sincronizacoes` → `inscricoes` é idempotente por
  `guru_transacao_id`.
- `codigo` é único por evento e não se repete sob criação concorrente.
- Expansão do roteiro: para `vagas` de 1 a 5, o número e a ordem dos passos
  batem com as perguntas ativas.
- `respostas` recusa escopo errado (participante preenchido em pergunta de
  inscrição e vice-versa).
- Dedup de `pessoas`: mesmo email com maiúscula ou espaço nas pontas e o mesmo
  nome caem na mesma ficha.
- **Não-fusão**: dois nomes diferentes sob o mesmo email geram duas pessoas
  (caso Janaína / Leonardo em `laguerryeventos@gmail.com`).
- As abas de tamanho agrupam por `vagas` e não se movem quando
  `pessoas_preenchidas` muda no meio de um check-in.
- Retomada: interromper no passo k e voltar restaura exatamente o passo k.

---

## Adendo (2026-08-19): como o Guru chega hoje

Confirmado pelo operador: os dados do Guru **não vão direto ao Typebot**. Existe
um passo intermediário — o Guru alimenta uma **planilha do Google**, e o Typebot
consulta essa planilha (`Get data from sheet`) para achar a inscrição pelo email.

Isso muda o desenho da Fatia D em um ponto prático: pode já existir uma
automação (Zapier, Make, ou o próprio webhook do Guru) escrevendo na planilha.
Se existir, o caminho mais curto não é configurar um webhook do zero — é
**reapontar a automação existente** para o endpoint do sistema, ou, na
transição, importar a própria planilha pelo caminho CSV que a `sincronizacoes`
já prevê.

A investigar antes de escrever o plano da Fatia D:

1. O que escreve na planilha hoje — webhook nativo do Guru, Zapier, Make, ou
   digitação manual?
2. Se for uma automação, ela aceita trocar a URL de destino?
3. A planilha tem colunas que o Guru manda mas que o Typebot não usa? Elas
   podem ser úteis (valor pago, data da compra, status do pagamento).

---

## Adendo (2026-08-19): o payload real do Guru, decifrado

A planilha `Inscrições ENGRENAGEM 2026` foi lida coluna a coluna. O caminho
atual é **Guru → webhook n8n → Google Sheets**, com o n8n auto-hospedado em
`regra3.bravy.com.br`. O nó de destino é um `Append row in sheet` com
mapeamento manual de colunas.

### As colunas que o Guru entrega

| Coluna | Exemplo | Observação |
|---|---|---|
| criado em | `23/06/2026 09:00:37` | quando a compra nasceu |
| confirmado em | `23/06/2026 09:09:06` | quando o pagamento foi aprovado |
| nome | `Diogo Rodrigues De Souza` | do comprador |
| documento | `7937761636` / `46221803000177` | **CPF ou CNPJ** — 11 ou 14 dígitos |
| email | `pallacebuffetptc@gmail.com` | o `email_compra` do modelo |
| DDI | `55` | separado do telefone |
| telefone | `34993395999` | sem DDI |
| **quantidade** | `2` | **é o `vagas`** — vem como número |
| status | `A` | aprovado |
| produto | `Engrenagem … 2026 [PRÉ-VENDA - 2 INSCRIÇÕES] - 15% OFF NA 2ª` | o número se repete no texto |

### O que isso muda no plano da Fatia D

1. **`vagas` não precisa ser extraído do nome do produto.** Existe a coluna
   numérica `quantidade`. O texto do produto vira conferência, não fonte.
2. **`documento` aceita CPF e CNPJ.** Modelar como CPF de 11 dígitos estaria
   errado — a inscrição da Janaína Guerrieri usa CNPJ.
3. **Não é preciso configurar nada no Guru.** O webhook do n8n já recebe tudo.
   Basta um nó `HTTP Request` em paralelo ao do Sheets, apontando para o
   endpoint do sistema. Trocar a URL de destino é a única mudança externa.
4. **`status = 'A'`** é o filtro: só compra aprovada vira inscrição.

### Confirmação do caso que sustentou o modelo

A linha `Janaína Garcia Guerrieri | laguerryeventos@gmail.com | quantidade 2`
está na planilha do Guru. É a mesma inscrição cujo acompanhante — Leonardo
Guerrieri — foi cadastrado com o email dela, e que motivou a chave de
identidade `email + nome`. O dado de origem confirma a decisão.

### Em aberto, antes de escrever o plano da Fatia D

1. **A planilha continua?** Rodar os dois em paralelo dá rede de segurança no
   primeiro evento; substituir de uma vez é mais limpo. Decisão do operador.
2. **O payload tem identificador único da transação?** As colunas da planilha
   não mostram, mas o webhook recebe mais campos do que os mapeados. Sem um
   `id`, a idempotência de `sincronizacoes` teria de usar email + carimbo de
   criação — o que confundiria duas compras do mesmo email no mesmo segundo.
   Verificar no nó `Webhook` do n8n, em "Listen for test event" ou numa
   execução antiga.
