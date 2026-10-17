-- Advent of Postgres, day 16: the error of the hour
create schema if not exists day16;
set search_path to day16;

create or replace function day16.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists errors;
create table errors (
  id          bigint primary key,
  occurred_at timestamptz not null,
  code        text not null
);

-- A steady mix of error codes all day, plus one big burst of E503 during a single bad hour.
insert into errors
select g,
       timestamptz '2026-12-16 00:00:00+00' + (h(g || ':t') % 86400) * interval '1 second',
       case when h(g || ':mix') % 100 < 30 then 'E429'
            when h(g || ':mix') % 100 < 55 then 'E500'
            when h(g || ':mix') % 100 < 75 then 'E503'
            else (array['E400','E404','E408','E502'])[1 + h(g || ':rest') % 4] end
from generate_series(1, 9000) g
union all
select 100000 + g, timestamptz '2026-12-16 14:00:00+00' + (h(g || ':b') % 3600) * interval '1 second', 'E503'
from generate_series(1, 1200) g;
