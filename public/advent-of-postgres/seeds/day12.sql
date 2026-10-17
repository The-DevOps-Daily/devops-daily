-- Advent of Postgres, day 12: the noisy alerts
create schema if not exists day12;
set search_path to day12;

create or replace function day12.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists alerts;
create table alerts (
  id       int primary key,
  team     text not null,
  rule     text not null,
  fired_at timestamptz not null
);

-- Each team has its own alert rules; a few rules are very noisy. The sleigh team's
-- rules are the noisiest overall, so a global top three is all sleigh.
with rules as (
  select team, rule, weight
  from (values
    ('sleigh', 'gps-drift', 60), ('sleigh', 'rein-tension', 55), ('sleigh', 'runner-temp', 50), ('sleigh', 'bell-silent', 8),
    ('toys', 'paint-queue', 30), ('toys', 'glue-temp', 25), ('toys', 'qa-backlog', 12), ('toys', 'spring-stock', 4),
    ('wrapping', 'tape-low', 22), ('wrapping', 'bow-jam', 18), ('wrapping', 'paper-tear', 16), ('wrapping', 'label-misprint', 6),
    ('naughty-list', 'appeal-spike', 14), ('naughty-list', 'coal-stock', 9), ('naughty-list', 'audit-lag', 7), ('naughty-list', 'cookie-bribe', 3)
  ) r(team, rule, weight)
)
insert into alerts
select row_number() over (order by r.team, r.rule, g),
       r.team, r.rule,
       timestamptz '2026-12-12 00:00:00+00' + (h(r.rule || g || ':t') % 86400) * interval '1 second'
from rules r
cross join generate_series(1, 80) g
where h(r.rule || g || ':keep') % 80 < r.weight;
