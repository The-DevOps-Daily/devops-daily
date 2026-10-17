-- Advent of Postgres, day 21: the deleted gifts
-- This day runs in three steps (-- @commit): the data, a pause, then the bad deploy.
create schema if not exists day21;
set search_path to day21;

create or replace function day21.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists gifts;
drop table if exists deploy_log;
create table gifts (
  id         int primary key,
  child_id   int not null,
  item       text not null,
  value      int not null,        -- candy canes
  wrapped    boolean not null
);
create table deploy_log (
  deployed_at timestamptz not null,
  release     text not null,
  note        text not null
);

insert into gifts
select g, 1 + (h(g || ':c') % 1200)::int,
       (array['sled','scarf','robot','puzzle','book','drum','kite','train'])[1 + h(g || ':i') % 8],
       5 + (h(g || ':v') % 95)::int,
       h(g || ':w') % 4 <> 0
from generate_series(1, 4000) g;
-- @commit
select pg_sleep(3);
-- @commit
insert into day21.deploy_log values (now(), 'cleanup-job 2.1', 'removes test rows from day21.gifts');
-- the cleanup job meant to delete test rows, but its filter was wrong
delete from day21.gifts where wrapped;
