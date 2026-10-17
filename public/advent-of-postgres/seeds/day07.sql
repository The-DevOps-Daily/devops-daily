-- Advent of Postgres, day 7: the duplicate events
create schema if not exists day07;
set search_path to day07;

create or replace function day07.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists order_events;
create table order_events (
  event_id    bigint primary key,
  order_id    int not null,
  status      text not null,      -- placed, packed, shipped, cancelled
  gift_value  int not null,       -- in candy canes
  received_at timestamptz not null
);

-- Every order moves through statuses; the queue delivers some events twice (retries).
with orders as (
  select o, 20 + (h(o || ':v') % 480)::int as value,
         (h(o || ':final') % 10) as fate   -- 0-1 cancelled, 2-3 stuck at packed, rest shipped
  from generate_series(1, 3000) o
), steps as (
  select o.o, o.value, s.status, s.k
  from orders o
  cross join lateral (
    values ('placed', 1), ('packed', 2), ('shipped', 3), ('cancelled', 3)
  ) s(status, k)
  where (s.k < 3 and not (o.fate between 0 and 1 and s.k = 2))
     or (s.k = 3 and s.status = 'shipped' and o.fate >= 4)
     or (s.k = 3 and s.status = 'cancelled' and o.fate between 0 and 1)
), copies as (
  select st.*, c
  from steps st
  cross join generate_series(1, 3) c
  where c = 1 or h(st.o || st.status || c || ':dup') % 5 = 0
)
insert into order_events
select row_number() over (order by o, k, c),
       o, status, value,
       timestamptz '2026-12-07 08:00:00+00' + (o * 7 + k * 600 + c * 3) * interval '1 second'
from copies;
