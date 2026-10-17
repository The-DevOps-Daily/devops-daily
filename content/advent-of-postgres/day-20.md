---
title: 'Day 20: The Risky Migration'
day: 20
excerpt: 'A cleanup migration that looks safe fails halfway. Test it on a Neon branch, fix it, and count what it really deletes.'
difficulty: 'Advanced'
skills:
  - Neon branches
  - Transactions
  - Constraints
schema: 'day20'
answerHash: '20129e8dc746e9f98e74fd869a609c614a9664f8011acc695a2ededc021ab32f'
answerFormat: 'A number of rows, for example 120'
starter: 'select email, count(*) from children group by email order by 2 desc limit 20;'
hint: 'Look at the emails that differ only by case or by a trailing space. The DELETE and the UPDATE do not agree on what counts as the same address.'
publishedAt: '2026-12-20T00:00:00Z'
---

The gift tracker lets children log in with their email, and some of them signed up two or three times. Bushy wrote a migration to clean that up and add a unique constraint. It runs tonight, on the real database.

You do not run unknown migrations on the real database. You run them on a copy first. On Neon, a **branch** is a full copy of your database that takes a second to create and costs nothing to throw away.

The children are in `children`:

| Column  | Type   | Notes                                               |
| ------- | ------ | --------------------------------------------------- |
| `id`    | `int`  | Primary key                                         |
| `name`  | `text` | The child's name                                    |
| `email` | `text` | The login; the same child can appear more than once |

Bushy's migration:

```sql
begin;
-- keep the first sign-up of every email, delete the rest
delete from day20.children c using day20.children d
 where lower(c.email) = lower(d.email) and c.id > d.id;
-- store every email the same way
update day20.children set email = lower(trim(email));
alter table day20.children add constraint children_email_key unique (email);
commit;
```

Branches need your database in your Neon account. The steps:

1. Run the starter query on this page, so today's data loads.
2. If you have not claimed your database yet, press "Keep it for the month" and claim it into a free Neon account. Neon resets the password during the move, so paste the new connection string when the page asks.
3. In the Neon Console, create a branch of the project.
4. Open the branch in the SQL Editor (or connect to it with psql) and run the migration there. The page runs one statement at a time, so it is not the place for a migration with `begin` and `commit`.

## Your task

The migration fails on your branch. Change only the `delete` so it compares `lower(trim(email))` on both sides, and run it again on your branch (the failed run rolled back, so the branch is unchanged). **How many rows does the fixed migration delete?**

Submit the number.
