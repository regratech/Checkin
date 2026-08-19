-- Gera o codigo legivel da inscricao, ex.: ENG26-0042.
--
-- O contador vive em eventos.proximo_codigo. Ler com `select` e depois
-- gravar com `update` deixaria duas compras simultaneas pegarem o mesmo
-- numero; `update ... returning` trava a linha do evento e resolve leitura
-- e incremento numa instrucao so.
create function gerar_codigo_inscricao(p_evento_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefixo text;
  v_numero int;
begin
  update eventos
    set proximo_codigo = proximo_codigo + 1
    where id = p_evento_id
    returning prefixo_codigo, proximo_codigo - 1
    into v_prefixo, v_numero;

  if v_prefixo is null then
    raise exception 'evento % nao encontrado', p_evento_id;
  end if;

  return v_prefixo || '-' || lpad(v_numero::text, 4, '0');
end;
$$;
