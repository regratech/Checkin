# O roteiro atual da Lara, extraído do Typebot

Data: 2026-08-19

Transcrição do fluxo `Checkin Engrenagem 2026`, feita a partir dos prints do
editor. Serve de referência para o roteiro do sistema novo — o objetivo é
manter a conversa igual à que o público já conhece.

**Ponto em aberto:** o nome da assistente. Na fonte do Typebot o `I` maiúsculo
e o `l` minúsculo saem idênticos, então "Iara" e "Lara" são indistinguíveis nos
prints. Confirmar antes de escrever a abertura.

---

## Abertura

> CHECK-IN A ENGRENAGEM
>
> Olá!
> Eu sou [L/I]ara, a assistente virtual da Regra 3.
>
> A inscrição já está confirmada.
>
> Esse é um formulário de check-in para providenciarmos as credenciais e
> conhecer melhor você.
>
> Será bem rápido, menos de 5 minutos. ⏱
>
> Ao chegar, o nome estará na lista de presença e o crachá será retirado na
> entrada do treinamento.

## Identificação — **eliminada no sistema novo**

O Typebot pede o email, avisa "digite tudo em minúsculo e exatamente como
colocou na inscrição", busca na planilha e compara literalmente. Falhando,
manda tentar de novo.

No sistema novo isso não existe: o link carrega o token e a pessoa já chega
identificada.

## Ramificação por quantidade — **eliminada no sistema novo**

`numero_insc = 1 | 2 | 3 | 4`, com um ramo copiado para cada. É o que
`expandirRoteiro` substitui por um laço.

## Confirmação do titular

> Verifiquei que neste e-mail há {N} inscrição.
>
> Os dados de quem vai participar são os mesmos da inscrição?
> Nome: {nome} · E-mail: {email} · Telefone: {telefone}
>
> [ Sim ] [ Não ]

Depois: "Ótimo, qual a data de nascimento?" (`dd/mm/aaaa`)

---

## As perguntas, na ordem

| # | Pergunta | Tipo | Escopo | Chave sugerida |
|---|---|---|---|---|
| 1 | Nome e sobrenome p/ crachá | texto curto | participante | *núcleo* |
| 2 | Qual o nome do buffet? | texto curto | inscrição | *núcleo* |
| 3 | Insira cidade e estado (Cidade/UF) | texto curto | inscrição | *núcleo* |
| 4 | É você quem faz o planejamento, a organização e a coordenação do evento? | seleção única | participante | `cargo` |
| 5 | Há quanto tempo tem e/ou trabalha com buffet? | texto curto | inscrição | `tempo_buffet` |
| 6 | Instagram profissional | texto curto | inscrição | *núcleo* |
| 7 | Qual é a média de público que atende? | seleção única | inscrição | `media_publico` |
| 8 | Qual foi o maior número de convidados que atendeu em um evento? | número | inscrição | `maior_evento` |
| 9 | Você já faz mais de um evento por dia? | sim ou não | inscrição | `mais_de_um_evento_dia` |
| 10 | Qual foi o máximo de eventos que realizou em um mesmo dia? | número | inscrição | `max_eventos_dia` |
| 11 | De 1 a 10, como fica a qualidade da entrega quando faz mais do que um evento? | nota | inscrição | `qualidade_multiplos` |
| 12 | Qual o maior obstáculo que impede você de realizar mais de 1 evento no mesmo dia? | texto longo | inscrição | `obstaculo_multiplos` |
| 13 | Quais são os tipos de festas/eventos que você faz? | seleção múltipla | inscrição | `tipos_eventos` |
| 14 | E quais os tipos de serviços que realiza? | seleção múltipla | inscrição | `tipos_servicos` |
| 15–21 | As sete notas de dificuldade | nota 0–5 | inscrição | ver abaixo |
| 22 | Antes de concluirmos, escreva em uma frase o que deseja alcançar após o treinamento | texto longo | inscrição | `expectativa` |

### Textos de apoio que acompanham as perguntas

- **Cargo:** "Escolha a resposta mais próxima da sua realidade."
- **Buffet:** "Se não quiser colocar, pode escrever 'Não tenho'."
- **Tempo de buffet:** "Queremos conhecer o seu momento para entregar o melhor
  treinamento" / "Não divulgaremos as suas informações."
- **Instagram:** "Se não tiver, coloque 'Não tenho'. Essas informações não serão
  divulgadas. Solicitamos apenas para que possamos conhecer os participantes
  com antecedência."
- **Tipos de eventos:** "Pode marcar mais de uma alternativa, se for o seu caso."

### Opções

**Cargo** (5 opções, na voz do titular):
1. Eu que planejo, organizo, coordeno e faço a comida.
2. Só não faço a comida, o restante é comigo.
3. Faço o planejamento […]
4. A equipe faz todo o trabalho […]
5. Sou responsável pela […]

Na planilha do último evento cada uma aparece em **duas redações** — primeira
pessoa para o titular, terceira para o acompanhante. É exatamente o caso que
`rotulo_acompanhante` resolve: uma chave, dois textos.

**Média de público** (5 faixas):
Não fiz evento ainda · Até 50 pessoas · Entre 51 e 250 · Entre 251 e 500 ·
Mais de 500

**Tipos de eventos:** Casamento · Aniversários · Corporativo · Formatura · Outros

**Tipos de serviços:** Coquetel · Ilha gastronômica/mesa de frios · Almoço e
jantar buffet · Estações gourmet · Coffee Break · Brunch · Café da manhã ·
Outros

### As sete notas de dificuldade

Precedidas de:

> Classifique de 1 a 5 os desafios de logística e organização que você encontra
> no seu trabalho e/ou no seu buffet.
>
> Leve em consideração que:
> **0** = nenhuma dificuldade · **entre 2 e 4** = alguma dificuldade ·
> **5** = muita dificuldade

*(o enunciado diz "de 1 a 5" mas a legenda começa em 0 — a escala real é 0 a 5,
como confirmam os valores da planilha)*

1. Você ou sua equipe sente dificuldade em alinhar com o cliente as
   expectativas dele e o que você pode oferecer?
2. Cálculo por pessoa, compras e produção dos alimentos.
3. Escolha e organização dos materiais.
4. Logística de transporte.
5. Planejamento e organização do evento com checklists, manuais e cronogramas.
6. Coordenação da equipe. Alinhar funções e delegar.
7. Técnicas e criatividade para a montagem de mesas.

Entre a quarta e a quinta: "Estamos quase acabando, essas são as últimas
classificações. 👇"

**Estas sete batem exatamente com as sete colunas de nota da planilha
arrumada** — `Primeiro Atend`, `Quantificacao e Producao`, `Selecao Materiais`,
`Logistica Transp`, `Organizar Evento`, `Coordenacao Equipe`, `Montagem Mesa`.

---

## Fechamento

> Ótimo, agradecemos por todas as informações.
> **O check-in está confirmado.**
>
> 📍 **Lembrando as informações principais do treinamento:**
> **Data:** 11 e 12/08.
> **Horário:** 9h às 19h.
> **Local:** Rua Gualaxo, 285 - Paraíso (Tênis Clube Paulista).
>
> Enviamos em seu e-mail o guia do aluno com o cronograma e o mapa de chegada. 📕
> Indico olhar em spam e qualquer dúvida, pode nos chamar no suporte.
> Aguarde novos recados. Até mais.
>
> [ FECHAR CHECK-IN ] → redireciona

Existe também um nó `envio manual - PART 1` com `Send email to {{email_insc}}`.

---

## Decisões em aberto

**1. O nome da assistente.** Ver acima.

**2. A ramificação da pergunta 9.** O Typebot ramifica: `SIM` leva às perguntas
10 e 11; `NÃO` leva à 12. O motor do sistema novo é **linear** — não tem
condição. Três caminhos:

- Perguntar as três a todos, as três opcionais (não mexe no motor)
- Acrescentar condição ao modelo de perguntas (fatia nova: modelo, motor,
  editor e conversa)
- Cortar as três, se o diagnóstico não for usado na prática

**3. Data, horário e local no fechamento.** Hoje escritos à mão no Typebot. Se
virarem campos do evento, trocar o endereço deixa de exigir mexer em código —
que é justamente o que o sistema deveria eliminar. `eventos` já tem `data` e
`local`; faltaria horário e um texto de encerramento editável.
