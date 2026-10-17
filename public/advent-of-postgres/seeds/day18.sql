-- Advent of Postgres, day 18: the lock pile-up
create schema if not exists day18;
set search_path to day18;

drop table if exists lock_snapshot;
create table lock_snapshot (
  pid        int primary key,
  query      text not null,
  blocked_by int[] not null      -- what pg_blocking_pids(pid) returned
);

-- A snapshot taken during a pile-up. One migration holds a lock that a long chain waits on;
-- a busy report job blocks many sessions directly but none of them block anyone else.
insert into lock_snapshot values
  (101, 'ALTER TABLE gifts ADD COLUMN wrap_style text', '{}'),
  (102, 'UPDATE gifts SET status = ''packed'' WHERE id = 5', '{101}'),
  (103, 'SELECT * FROM gifts WHERE id = 9 FOR UPDATE', '{102}'),
  (104, 'UPDATE gifts SET status = ''shipped'' WHERE id = 9', '{103}'),
  (105, 'DELETE FROM gifts WHERE id = 12', '{101}'),
  (106, 'UPDATE gift_stats SET n = n + 1', '{104,105}'),
  (107, 'UPDATE gift_stats SET n = n + 1', '{106}'),
  (108, 'INSERT INTO gift_audit SELECT * FROM gifts WHERE id = 9', '{104}'),
  (201, 'LOCK TABLE reports IN EXCLUSIVE MODE', '{}'),
  (202, 'INSERT INTO reports VALUES (1)', '{201}'),
  (203, 'INSERT INTO reports VALUES (2)', '{201}'),
  (204, 'INSERT INTO reports VALUES (3)', '{201}'),
  (205, 'INSERT INTO reports VALUES (4)', '{201}'),
  (206, 'INSERT INTO reports VALUES (5)', '{201}'),
  (207, 'UPDATE reports SET seen = true', '{201}'),
  (301, 'VACUUM elves', '{}'),
  (302, 'SELECT count(*) FROM elves', '{}');
