-- O endpoint do Guru e publico: quem chama nao faz login. A autenticacao
-- e um segredo POR EVENTO, no cabecalho `x-checkin-segredo`. Um segredo
-- global vazaria o acesso a todos os eventos de uma vez.
--
-- `gen_random_uuid()` e do nucleo do Postgres desde a versao 13. Usar
-- `gen_random_bytes` exigiria a extensao pgcrypto, que pode nao estar
-- habilitada — e a migration falharia por um detalhe evitavel.
alter table eventos
  add column webhook_segredo text not null
  default replace(gen_random_uuid()::text, '-', '') ||
          replace(gen_random_uuid()::text, '-', '');

-- O Guru manda `doc`, que e CPF (11 digitos) ou CNPJ (14). A inscricao da
-- Janaina Guerrieri usa CNPJ — modelar como CPF de tamanho fixo recusaria
-- dado real.
alter table inscricoes
  add column documento_compra text;

-- A chave de idempotencia da sincronizacao. Vem do identificador da
-- transacao quando o payload tiver um; senao e derivada de
-- documento + email + criado_em. Ver `chaveDeIdempotencia` em lib/guru.ts.
alter table sincronizacoes
  add column chave text;

-- `nulls not distinct`: NULL nunca e igual a NULL num unique comum, e foi
-- exatamente esse o defeito que a migration 007 corrigiu em `respostas`.
-- A chave nunca deveria ser nula, mas a restricao nao pode depender disso
-- para valer.
--
-- ATENCAO: com `nulls not distinct`, duas linhas de chave NULA no mesmo
-- evento colidem. A tabela esta vazia hoje; se houver linhas antigas,
-- preencha a chave delas antes de rodar isto.
alter table sincronizacoes
  add constraint sincronizacoes_chave_unica
  unique nulls not distinct (evento_id, chave);
