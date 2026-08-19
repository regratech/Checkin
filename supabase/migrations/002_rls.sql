alter table perfis enable row level security;
alter table eventos enable row level security;
alter table pessoas enable row level security;
alter table inscricoes enable row level security;
alter table participantes enable row level security;
alter table perguntas enable row level security;
alter table respostas enable row level security;
alter table sincronizacoes enable row level security;

-- `set search_path` e obrigatorio numa funcao security definer: sem ele
-- alguem pode criar uma tabela `perfis` num schema que venha antes no
-- caminho e a funcao passa a consultar a tabela errada, com privilegio.
create function eh_admin() returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from perfis where id = auth.uid() and papel = 'admin'
  );
$$;

-- Perfil: a linha nasce no cadastro e nunca e editada pela aplicacao.
-- Promocao a admin e manual, pelo SQL Editor com service role.
create policy "perfil proprio leitura" on perfis
  for select using (id = auth.uid() or eh_admin());
create policy "perfil proprio insercao" on perfis
  for insert with check (id = auth.uid() and papel = 'publico');

-- Todo o resto do check-in e dado pessoal de terceiros: so admin le.
-- O participante nunca consulta tabela — ele chega pelo token e as rotas
-- de servidor, com service_role, devolvem apenas o passo dele.
create policy "eventos somente admin" on eventos
  for all using (eh_admin()) with check (eh_admin());
create policy "pessoas somente admin" on pessoas
  for all using (eh_admin()) with check (eh_admin());
create policy "inscricoes somente admin" on inscricoes
  for all using (eh_admin()) with check (eh_admin());
create policy "participantes somente admin" on participantes
  for all using (eh_admin()) with check (eh_admin());
create policy "perguntas somente admin" on perguntas
  for all using (eh_admin()) with check (eh_admin());
create policy "respostas somente admin" on respostas
  for all using (eh_admin()) with check (eh_admin());
create policy "sincronizacoes somente admin" on sincronizacoes
  for all using (eh_admin()) with check (eh_admin());
