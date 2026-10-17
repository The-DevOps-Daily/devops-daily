-- Advent of Postgres, day 11: the cloud bill
create schema if not exists day11;
set search_path to day11;

create or replace function day11.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists daily_costs;
create table daily_costs (
  team  text not null,
  day   date not null,
  cost  int not null,          -- candy canes spent that day
  primary key (team, day)
);

insert into daily_costs
select t.name, d::date,
       t.base + (h(t.name || to_char(d, 'YYYY-MM-DD') || ':c') % t.base)::int
         + case when t.name = 'wrapping' and d::date between '2026-12-06' and '2026-12-08' then 900 else 0 end
from (values ('wrapping', 300), ('sleigh', 520), ('toys', 410), ('naughty-list', 150)) t(name, base)
cross join generate_series(date '2026-12-01', date '2026-12-24', interval '1 day') d;
