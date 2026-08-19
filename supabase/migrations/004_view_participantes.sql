-- Uma linha por participante, com os dados do buffet repetidos em cada
-- linha do grupo. E o formato que a operacao hoje monta a mao depois de
-- cada evento; aqui ele sai do join.
--
-- security_invoker: sem isso a view roda com o privilegio de quem a criou
-- e passaria por cima da RLS das tabelas de baixo.
create view vw_participantes
with (security_invoker = on) as
select
  p.id,
  p.inscricao_id,
  p.pessoa_id,
  p.ordem,
  p.titular,
  p.nome,
  p.email,
  p.telefone,
  p.data_nascimento,
  p.nome_cracha,
  p.cargo,
  i.evento_id,
  i.codigo,
  i.vagas,
  i.empresa_nome,
  i.empresa_cidade,
  i.empresa_instagram,
  i.status_checkin,
  i.codigo || '-' || p.ordem as codigo_participante,
  count(*) over (partition by p.inscricao_id) as pessoas_preenchidas
from participantes p
join inscricoes i on i.id = p.inscricao_id;
