-- Ninguem se leva a si proprio como acompanhante.
--
-- Ate aqui, `unique (inscricao_id, ordem)` impedia dois "participante 2" na
-- mesma compra, mas nada impedia a MESMA pessoa ocupar as duas vagas. Como a
-- identidade e o par email + nome normalizado, digitar o mesmo nome e o mesmo
-- email duas vezes gerava duas participacoes apontando para uma pessoa so.
--
-- ANTES DE RODAR: esta consulta lista o que ja viola a regra. Se ela
-- devolver alguma linha, a restricao abaixo falha. Decida o que fazer com
-- cada caso — corrigir o nome do acompanhante, ou apagar a inscricao de
-- teste — e rode a consulta de novo ate voltar vazia.
--
--   select
--     i.codigo,
--     p.pessoa_id,
--     count(*) as vezes,
--     string_agg(p.nome || ' (ordem ' || p.ordem || ')', ', ' order by p.ordem) as linhas
--   from participantes p
--   join inscricoes i on i.id = p.inscricao_id
--   group by i.codigo, p.pessoa_id
--   having count(*) > 1;
--
-- A migration nao apaga nada sozinha: decidir qual das linhas some e do
-- dono do dado, nao de quem escreveu o schema.

alter table participantes
  add constraint participantes_pessoa_unica_por_inscricao
  unique (inscricao_id, pessoa_id);
