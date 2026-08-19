create type papel_usuario as enum ('publico', 'admin');
create type origem_inscricao as enum ('webhook', 'api', 'csv', 'manual');
create type status_checkin as enum ('pendente', 'em_andamento', 'concluido');
create type escopo_pergunta as enum ('inscricao', 'participante');
create type tipo_pergunta as enum (
  'texto_curto', 'texto_longo', 'email', 'telefone', 'numero', 'data',
  'selecao_unica', 'selecao_multipla', 'nota_estrela', 'sim_nao'
);
create type status_sincronizacao as enum ('recebida', 'promovida', 'erro');

create table perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  email text not null,
  papel papel_usuario not null default 'publico',
  criado_em timestamptz not null default now()
);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  prefixo_codigo text not null,
  proximo_codigo int not null default 1,
  data date,
  local text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Identidade da pessoa entre eventos. A chave e o PAR email + nome_chave.
-- Email sozinho funde pessoas distintas: acompanhantes costumam ser
-- cadastrados com o email do titular (7 dos 13 grupos do ultimo evento).
-- Duplicar e reversivel; fundir dois seres humanos nao e.
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome_chave text not null,
  nome_recente text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (email, nome_chave)
);

create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  codigo text not null,
  pessoa_titular_id uuid references pessoas on delete set null,
  origem origem_inscricao not null,
  guru_transacao_id text,
  guru_payload jsonb,
  email_compra text,
  nome_compra text,
  telefone_compra text,
  valor numeric(10, 2),
  status_pagamento text,
  vagas int not null check (vagas >= 1),
  empresa_nome text,
  empresa_cidade text,
  empresa_instagram text,
  token text not null unique,
  status_checkin status_checkin not null default 'pendente',
  passo_atual text,
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (evento_id, codigo),
  unique (evento_id, guru_transacao_id)
);

create index inscricoes_evento_vagas_idx on inscricoes (evento_id, vagas);

-- Os dados aqui sao um retrato do que foi digitado NAQUELE evento.
-- Nome e telefone nao vem de `pessoas`: acompanhantes sao sempre coletados
-- em branco, entao o dado do evento e o mais recente por definicao.
create table participantes (
  id uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references inscricoes on delete cascade,
  pessoa_id uuid not null references pessoas on delete restrict,
  ordem int not null check (ordem >= 1),
  titular boolean not null default false,
  nome text not null,
  email text,
  telefone text,
  data_nascimento date,
  nome_cracha text,
  cargo text,
  criado_em timestamptz not null default now(),
  unique (inscricao_id, ordem)
);

create index participantes_pessoa_idx on participantes (pessoa_id);

create table perguntas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  chave text not null,
  rotulo text not null,
  texto_chat text not null,
  tipo tipo_pergunta not null,
  escopo escopo_pergunta not null,
  obrigatoria boolean not null default false,
  ordem int not null,
  opcoes jsonb,
  ajuda text,
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  unique (evento_id, chave),
  unique (id, escopo)
);

create index perguntas_ordem_idx on perguntas (evento_id, ativa, ordem);

-- `escopo` e denormalizado de proposito: com ele a FK composta abaixo
-- impede que uma resposta de escopo `inscricao` carregue participante_id,
-- e vice-versa. Sem isso a regra so existiria no codigo da aplicacao.
create table respostas (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null,
  escopo escopo_pergunta not null,
  inscricao_id uuid not null references inscricoes on delete cascade,
  participante_id uuid references participantes on delete cascade,
  valor jsonb not null,
  respondido_em timestamptz not null default now(),
  foreign key (pergunta_id, escopo) references perguntas (id, escopo) on delete cascade,
  check ((escopo = 'participante') = (participante_id is not null)),
  unique (pergunta_id, inscricao_id, participante_id)
);

create index respostas_inscricao_idx on respostas (inscricao_id);

create table sincronizacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos on delete cascade,
  origem origem_inscricao not null,
  recebido_em timestamptz not null default now(),
  payload jsonb not null,
  status status_sincronizacao not null default 'recebida',
  erro text,
  inscricao_id uuid references inscricoes on delete set null
);

create index sincronizacoes_triagem_idx on sincronizacoes (evento_id, status, recebido_em);
