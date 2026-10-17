-- Advent of Postgres, day 8: the JSON logs
create schema if not exists day08;
set search_path to day08;

create or replace function day08.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists logs;
create table logs (
  id   bigint primary key,
  ts   timestamptz not null,
  body jsonb not null
);

-- Structured logs from every service. The user block is missing on anonymous requests.
insert into logs
select g,
       timestamptz '2026-12-08 00:00:00+00' + (h(g || ':t') % 86400) * interval '1 second',
       jsonb_build_object(
         'level', (array['info','info','info','warn','error'])[1 + h(g || ':lvl') % 5],
         'service', (array['sleigh-api','gift-router','list-checker','elf-auth'])[1 + h(g || ':svc') % 4],
         'msg', 'request handled',
         'ctx', jsonb_build_object('region', reg.region)
                || case when h(g || ':anon') % 4 = 0 then '{}'::jsonb
                        else jsonb_build_object('user', jsonb_build_object(
                               'id', 'u' || (h(g || ':uid') % 5000),
                               'tier', case when reg.region = 'ap-south' and h(g || ':tierx') % 3 = 0 then 'gold'
                                            else (array['free','free','free','silver','gold'])[1 + h(g || ':tier') % 5] end))
                   end
       )
from generate_series(1, 20000) g
cross join lateral (
  select case when h(g || ':reg') % 10 < 4 then 'eu-north'
              when h(g || ':reg') % 10 < 7 then 'us-east'
              else 'ap-south' end as region
) reg;
