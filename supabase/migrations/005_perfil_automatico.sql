-- O perfil nasce na mesma transacao do cadastro. Fazer isso pela aplicacao
-- criaria uma janela em que auth.signUp da certo e o insert em perfis
-- falha depois, deixando a pessoa autenticada e sem perfil, sem caminho de
-- recuperacao.
--
-- `papel` e o literal 'publico'. Nunca leia de raw_user_meta_data: aquilo
-- vem do navegador de quem se cadastra, e uma funcao security definer que
-- confie nesse dado vira escalada de privilegio.
create function criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nome'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'publico'
  );
  return new;
end;
$$;

create trigger perfil_apos_cadastro
  after insert on auth.users
  for each row execute function criar_perfil_do_usuario();
