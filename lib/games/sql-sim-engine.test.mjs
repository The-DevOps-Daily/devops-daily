/**
 * Engine correctness test for the SQL Terminal Simulator.
 *
 * Run with:  npx tsx lib/games/sql-sim-engine.test.mjs
 *
 * Asserts the verified single-table outputs (captured from real Postgres) and
 * the canned join/subquery/window results.
 */
import assert from 'node:assert/strict';
import { runQuery, resultsMatch } from './sql-sim-engine.ts';

let passed = 0;

function check(label, sql, expected) {
  const result = runQuery(sql);
  assert.ok(!('error' in result), `${label}: unexpected error -> ${JSON.stringify(result)}`);
  assert.deepEqual(result, expected, `${label} mismatch`);
  passed += 1;
  console.log(`  ok  ${label}`);
}

console.log('SQL engine tests\n');

// 1. SELECT * FROM customers -> 8 rows, all columns, dates as YYYY-MM-DD
{
  const result = runQuery('SELECT * FROM customers;');
  assert.ok(!('error' in result));
  assert.deepEqual(result.columns, ['customer_id', 'name', 'country', 'signup_date']);
  assert.equal(result.rows.length, 8);
  assert.deepEqual(result.rows[0], [1, 'Alice Johnson', 'USA', '2025-01-15']);
  assert.deepEqual(result.rows[7], [8, 'Henry Wilson', 'Canada', '2025-07-21']);
  passed += 1;
  console.log('  ok  SELECT * FROM customers');
}

// 2. WHERE filter
check('WHERE country = USA', "SELECT name, country FROM customers WHERE country = 'USA';", {
  columns: ['name', 'country'],
  rows: [
    ['Alice Johnson', 'USA'],
    ['Carol White', 'USA'],
    ['Grace Lee', 'USA'],
  ],
});

// 3. ORDER BY + LIMIT
check('ORDER BY price DESC LIMIT 5', 'SELECT name, price FROM products ORDER BY price DESC LIMIT 5;', {
  columns: ['name', 'price'],
  rows: [
    ['Standing Desk', '399.99'],
    ['Monitor', '199.99'],
    ['Desk Chair', '149.99'],
    ['Webcam', '79.99'],
    ['Keyboard', '49.99'],
  ],
});

// 4. DISTINCT (any stable order is fine -> assert as a set)
{
  const result = runQuery('SELECT DISTINCT category FROM products;');
  assert.ok(!('error' in result));
  assert.deepEqual(result.columns, ['category']);
  const values = result.rows.map((row) => row[0]).sort();
  assert.deepEqual(values, ['Electronics', 'Furniture', 'Stationery']);
  passed += 1;
  console.log('  ok  SELECT DISTINCT category');
}

// 5. COUNT(*)
check('COUNT(*) AS order_count', 'SELECT count(*) AS order_count FROM orders;', {
  columns: ['order_count'],
  rows: [[12]],
});

// 6. GROUP BY + ORDER BY on the count
check(
  'GROUP BY status ORDER BY orders DESC',
  'SELECT status, count(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC;',
  {
    columns: ['status', 'orders'],
    rows: [
      ['delivered', 5],
      ['shipped', 3],
      ['pending', 2],
      ['cancelled', 2],
    ],
  },
);

// 7. HAVING + round(avg())
check(
  'HAVING count(*) > 2 + round(avg())',
  'SELECT category, count(*) AS n, round(avg(price),2) AS avg_price FROM products GROUP BY category HAVING count(*) > 2 ORDER BY avg_price DESC;',
  {
    columns: ['category', 'n', 'avg_price'],
    rows: [
      ['Furniture', 3, '194.99'],
      ['Electronics', 5, '72.99'],
    ],
  },
);

// 8-11. Canned multi-table / subquery / window queries
check(
  'JOIN shipped orders',
  "SELECT o.order_id, c.name, o.status FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = 'shipped' ORDER BY o.order_id;",
  {
    columns: ['order_id', 'name', 'status'],
    rows: [
      [1003, 'Alice Johnson', 'shipped'],
      [1006, 'Emma Davis', 'shipped'],
      [1009, 'Grace Lee', 'shipped'],
    ],
  },
);

check(
  'Revenue per customer (4-table join)',
  'SELECT c.name, SUM(oi.quantity * p.price) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY c.name ORDER BY revenue DESC;',
  {
    columns: ['name', 'revenue'],
    rows: [
      ['Bob Smith', '579.96'],
      ['Grace Lee', '399.99'],
      ['David Brown', '399.99'],
      ['Emma Davis', '399.98'],
      ['Alice Johnson', '349.91'],
      ['Henry Wilson', '199.99'],
      ['Frank Miller', '164.97'],
      ['Carol White', '113.82'],
    ],
  },
);

check(
  'Subquery above avg price',
  'SELECT name, price FROM products WHERE price > (SELECT avg(price) FROM products) ORDER BY price DESC;',
  {
    columns: ['name', 'price'],
    rows: [
      ['Standing Desk', '399.99'],
      ['Monitor', '199.99'],
      ['Desk Chair', '149.99'],
    ],
  },
);

check(
  'Window rank per category',
  'SELECT name, category, price, rank() OVER (PARTITION BY category ORDER BY price DESC) AS rnk FROM products ORDER BY category, rnk;',
  {
    columns: ['name', 'category', 'price', 'rnk'],
    rows: [
      ['Monitor', 'Electronics', '199.99', 1],
      ['Webcam', 'Electronics', '79.99', 2],
      ['Keyboard', 'Electronics', '49.99', 3],
      ['Mouse', 'Electronics', '24.99', 4],
      ['USB-C Cable', 'Electronics', '9.99', 5],
      ['Standing Desk', 'Furniture', '399.99', 1],
      ['Desk Chair', 'Furniture', '149.99', 2],
      ['Desk Lamp', 'Furniture', '34.99', 3],
      ['Pen Set', 'Stationery', '12.99', 1],
      ['Notebook', 'Stationery', '4.99', 2],
    ],
  },
);

// 12. LEFT JOIN canned result: every customer, pending order or NULLs.
check(
  'LEFT JOIN customers to pending orders',
  "SELECT c.name, o.order_id, o.status FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'pending' ORDER BY c.name;",
  {
    columns: ['name', 'order_id', 'status'],
    rows: [
      ['Alice Johnson', 1007, 'pending'],
      ['Bob Smith', null, null],
      ['Carol White', 1010, 'pending'],
      ['David Brown', null, null],
      ['Emma Davis', null, null],
      ['Frank Miller', null, null],
      ['Grace Lee', null, null],
      ['Henry Wilson', null, null],
    ],
  },
);

// 13. CTE canned result: customers who spent above the average.
check(
  'CTE above-average spend',
  'WITH customer_spend AS (SELECT c.name, SUM(oi.quantity * p.price) AS total FROM customers c JOIN orders o ON o.customer_id = c.customer_id JOIN order_items oi ON oi.order_id = o.order_id JOIN products p ON p.product_id = oi.product_id GROUP BY c.name) SELECT name, total FROM customer_spend WHERE total > (SELECT avg(total) FROM customer_spend) ORDER BY total DESC;',
  {
    columns: ['name', 'total'],
    rows: [
      ['Bob Smith', '579.96'],
      ['David Brown', '399.99'],
      ['Grace Lee', '399.99'],
      ['Emma Davis', '399.98'],
      ['Alice Johnson', '349.91'],
    ],
  },
);

// 14. DML command tags (nothing is persisted; tags reflect the live dataset).
{
  const insert = runQuery("INSERT INTO customers VALUES (9, 'Ivy Chen', 'USA', '2025-08-01');");
  assert.deepEqual(insert, { command: 'INSERT 0 1' });
  const update = runQuery('UPDATE products SET price = 54.99 WHERE product_id = 1;');
  assert.deepEqual(update, { command: 'UPDATE 1' });
  const del = runQuery("DELETE FROM orders WHERE status = 'cancelled';");
  assert.deepEqual(del, { command: 'DELETE 2' });
  passed += 1;
  console.log('  ok  DML command tags (INSERT 0 1 / UPDATE 1 / DELETE 2)');
}

// 15. Challenge comparator: the reference solution grades PASS, a wrong query fails.
{
  const reference = "SELECT name FROM customers WHERE country = 'UK' ORDER BY name";
  // Same query -> match.
  assert.equal(resultsMatch(runQuery(reference), runQuery(reference)), true);
  // Different column alias, same rows -> still a match (headers ignored).
  const aliased = "SELECT name AS customer FROM customers WHERE country = 'UK' ORDER BY name";
  assert.equal(resultsMatch(runQuery(aliased), runQuery(reference)), true);
  // Wrong query (missing WHERE) -> no match.
  assert.equal(resultsMatch(runQuery('SELECT name FROM customers'), runQuery(reference)), false);
  passed += 1;
  console.log('  ok  challenge comparator (pass + alias-insensitive + fail)');
}

// Bonus: an unsupported live multi-table query returns the friendly error.
{
  const result = runQuery('SELECT * FROM orders o JOIN customers c ON c.customer_id = o.customer_id;');
  assert.ok('error' in result, 'expected friendly error for unknown multi-table query');
  passed += 1;
  console.log('  ok  friendly error for unsupported join');
}

console.log(`\nAll ${passed} assertions passed.`);
