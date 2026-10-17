-- Advent of Postgres, day 5: the slow tail
create schema if not exists day05;
set search_path to day05;

create or replace function day05.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists requests;
create table requests (
  id         bigint primary key,
  service    text not null,
  started_at timestamptz not null,
  latency_ms int not null
);

-- Most requests are fast. Two services hide trouble differently:
-- cocoa-billing has a few enormous outliers (a high mean), gift-router a fat slow tail (a high p95).
insert into requests
select g,
       svc.name,
       timestamptz '2026-12-05 00:00:00+00' + (h(g || ':t') % 86400) * interval '1 second',
       case
         when svc.name = 'cocoa-billing' and h(g || ':o') % 400 = 0 then 30000 + (h(g || ':ov') % 30000)::int
         when svc.name = 'gift-router' and h(g || ':tail') % 100 < 9 then 900 + (h(g || ':tv') % 700)::int
         else 20 + (h(g || ':base') % svc.spread)::int
       end
from generate_series(1, 60000) g
cross join lateral (
  select (array['sleigh-api','gift-router','list-checker','cocoa-billing','elf-auth'])[1 + h(g || ':svc') % 5] as name
) pick
cross join lateral (
  select pick.name, case pick.name when 'list-checker' then 600 when 'elf-auth' then 350 else 250 end as spread
) svc;
