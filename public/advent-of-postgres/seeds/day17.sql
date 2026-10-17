-- Advent of Postgres, day 17: the inventory sync
create schema if not exists day17;
set search_path to day17;

create or replace function day17.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists stock;
drop table if exists supplier_feed;
create table stock (
  sku      text primary key,
  quantity int not null
);
create table supplier_feed (
  sku          text primary key,
  quantity     int not null,      -- the supplier's new count
  discontinued boolean not null
);

-- The warehouse knows 600 SKUs. The feed covers some of them, plus new ones.
insert into stock
select 'SKU-' || lpad(g::text, 4, '0'), 5 + (h(g || ':q') % 200)::int
from generate_series(1, 600) g;

insert into supplier_feed
select 'SKU-' || lpad(g::text, 4, '0'),
       (h(g || ':nq') % 300)::int,
       h(g || ':disc') % 9 = 0
from generate_series(400, 900) g
where h(g || ':in') % 3 <> 0;
