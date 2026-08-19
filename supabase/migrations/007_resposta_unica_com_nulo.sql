-- A unicidade de `respostas` nao valia para o buffet.
--
-- `unique (pergunta_id, inscricao_id, participante_id)` nao protege nada
-- quando participante_id e NULL — e ele e NULL em toda resposta de escopo
-- `inscricao`, que sao justamente faturamento, as notas e a expectativa.
-- No Postgres, NULL nunca e igual a NULL para efeito de unicidade, entao
-- duas gravacoes da mesma resposta criam duas linhas.
--
-- Na pratica: corrigir o faturamento na revisao final geraria uma segunda
-- linha em vez de sobrescrever, e a tabela e o CSV escolheriam uma delas
-- por acaso.
--
-- Confirmado por sonda no banco antes de escrever esta migration.
-- `nulls not distinct` existe desde o Postgres 15; este projeto roda 17.

-- 1. Limpa duplicatas que ja possam existir, mantendo a mais recente.
delete from respostas r
using (
  select id, row_number() over (
    partition by pergunta_id, inscricao_id, participante_id
    order by respondido_em desc, id desc
  ) as posicao
  from respostas
) as ordenadas
where r.id = ordenadas.id and ordenadas.posicao > 1;

-- 2. Remove a restricao antiga. O nome e gerado automaticamente e pode
--    variar, entao vem do catalogo em vez de ser escrito a mao.
do $$
declare
  v_nome text;
begin
  select conname into v_nome
  from pg_constraint
  where conrelid = 'respostas'::regclass
    and contype = 'u'
    and array_length(conkey, 1) = 3;

  if v_nome is not null then
    execute format('alter table respostas drop constraint %I', v_nome);
  end if;
end $$;

-- 3. Recria contando NULL como valor comparavel.
alter table respostas
  add constraint respostas_unica_por_alvo
  unique nulls not distinct (pergunta_id, inscricao_id, participante_id);
