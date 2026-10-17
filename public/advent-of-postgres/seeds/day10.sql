-- Advent of Postgres, day 10: the maintenance windows
create schema if not exists day10;
set search_path to day10;

create or replace function day10.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists maintenance;
create table maintenance (
  id      int primary key,
  service text not null,
  window_ tstzrange not null   -- [start, end)
);

-- Windows start on the quarter hour and last 15 to 90 minutes, so many of them touch end to start.
insert into maintenance
select g,
       (array['sleigh-api','gift-router','list-checker','wrap-queue','chimney-dns','elf-auth'])[1 + h(g || ':svc') % 6],
       tstzrange(t.s, t.s + (15 * (1 + h(g || ':len') % 6)) * interval '1 minute', '[)')
from generate_series(1, 60) g
cross join lateral (
  select timestamptz '2026-12-10 00:00:00+00' + (15 * (h(g || ':start') % 96)) * interval '1 minute' as s
) t;
