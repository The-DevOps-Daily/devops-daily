---
title: 'Day 17: The Inventory Sync'
day: 17
excerpt: "Apply the supplier's feed to the warehouse stock: update, insert, and remove what was discontinued. MERGE does it in one statement."
difficulty: 'Intermediate'
skills:
  - MERGE
  - Upserts
schema: 'day17'
answerHash: 'e9bd3c64cdf4f4a2d17bd34ccbc8b170854a94f5bd23cb1a6b34614e58cd74c4'
answerFormat: 'A number, for example 90000'
starter: 'select * from supplier_feed order by sku limit 20;'
hint: "MERGE INTO stock USING supplier_feed ON ... WHEN MATCHED AND discontinued THEN DELETE, WHEN MATCHED THEN UPDATE, WHEN NOT MATCHED AND NOT discontinued THEN INSERT. Reset today's data if you want to start over."
publishedAt: '2026-12-17T00:00:00Z'
---

The toy supplier sends a feed every night, and the warehouse stock has to match it. Sugarplum usually does this by hand. Tonight you offer to do it in SQL.

The warehouse stock is in `stock`:

| Column     | Type   | Notes            |
| ---------- | ------ | ---------------- |
| `sku`      | `text` | Primary key      |
| `quantity` | `int`  | Units on shelves |

The feed is in `supplier_feed`:

| Column         | Type      | Notes                                  |
| -------------- | --------- | -------------------------------------- |
| `sku`          | `text`    | Primary key                            |
| `quantity`     | `int`     | The supplier's new count               |
| `discontinued` | `boolean` | The supplier no longer makes this item |

The rules:

1. A SKU in both tables gets the feed's quantity.
2. A SKU that is in the feed but not in stock is added, unless it is discontinued.
3. A discontinued SKU is removed from stock.
4. A SKU that is not in the feed stays as it is.

`MERGE` (Postgres 15 and later) applies all of this in one statement. You can also work out the result without changing any data.

## Your task

After the sync, what is the **total quantity of all SKUs in stock**?

Submit the number.
