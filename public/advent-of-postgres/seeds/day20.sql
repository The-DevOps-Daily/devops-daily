-- Advent of Postgres, day 20: the risky migration
create schema if not exists day20;
set search_path to day20;

create or replace function day20.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists children;
create table children (
  id    int primary key,
  name  text not null,
  email text not null          -- the gift tracker login; the same child signed up more than once
);

-- Some children signed up again with different capital letters, and some of those
-- sign-ups also picked up a trailing space from a copy and paste.
with base as (
  select g, 'child' || g || '@north.pole' as email from generate_series(1, 1437) g
), extra as (
  select 1437 + row_number() over (order by b.g, k) as id, b.g,
         case when h(b.g || ':' || k || ':ws') % 3 = 0 then upper(b.email) || ' '
              else initcap(b.email) end as email
  from base b
  cross join generate_series(1, 2) k
  where h(b.g || ':' || k || ':dup') % 7 = 0
)
insert into children
select g, 'Child ' || g, email from base
union all
select id, 'Child ' || g, email from extra;
