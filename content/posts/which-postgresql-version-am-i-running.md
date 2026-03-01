---
title: 'How to Check Which Version of PostgreSQL You Are Running'
excerpt: "Learn multiple ways to check your PostgreSQL version, including psql commands, SQL queries, and system commands. Find version numbers from the server, client, and package manager."
category:
  name: 'Database'
  slug: 'database'
date: '2024-12-15'
publishedAt: '2024-12-15T09:00:00Z'
updatedAt: '2024-12-15T09:00:00Z'
readingTime: '6 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - PostgreSQL
  - Database
  - Version
  - System Administration
  - SQL
---

You need to know which version of PostgreSQL you're running - maybe for compatibility checks, bug reports, or upgrade planning. What's the quickest way to find out?

## TL;DR

Use `psql --version` to check the client version from the command line. To check the server version, connect with `psql` and run `SELECT version();` or use `SHOW server_version;`. From the shell without connecting, use `postgres --version` (if you have direct server access) or `psql -c "SELECT version();"`. The server version is what matters for compatibility and features.

There's a difference between the client version (psql tool) and the server version (actual database). Both are important to know.

## Checking Client Version

The psql client version:

```bash
psql --version
```

Output:
```
psql (PostgreSQL) 14.8 (Ubuntu 14.8-1.pgdg22.04+1)
```

This tells you the version of the `psql` command-line tool installed on your machine, not necessarily the server version.

## Checking Server Version from SQL

Connect to PostgreSQL and run SQL commands:

```bash
psql -U postgres
```

Then in the PostgreSQL prompt:

```sql
SELECT version();
```

Output:
```
                                                 version
---------------------------------------------------------------------------------------------------------
 PostgreSQL 14.8 on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 11.3.0-1ubuntu1~22.04.1) 11.3.0, 64-bit
(1 row)
```

This shows the actual server version along with platform and compiler information.

For just the version number:

```sql
SHOW server_version;
```

Output:
```
 server_version
----------------
 14.8
(1 row)
```

## Checking Server Version from Command Line

Without entering the PostgreSQL prompt:

```bash
psql -c "SELECT version();"
```

Or for just the version number:

```bash
psql -c "SHOW server_version;"
```

Add connection parameters if needed:

```bash
psql -h localhost -U postgres -d mydatabase -c "SHOW server_version;"
```

## Getting Version Number Only

Extract just the numeric version:

```bash
psql -t -c "SHOW server_version;" | tr -d ' '
```

The `-t` flag outputs without headers, and `tr` removes spaces.

Or with `awk`:

```bash
psql -t -c "SELECT version();" | awk '{print $2}'
```

## Checking from the postgres Binary

If you have access to the PostgreSQL server binary:

```bash
postgres --version
```

Or the specific binary path:

```bash
/usr/lib/postgresql/14/bin/postgres --version
```

This shows the version of the PostgreSQL server software installed, regardless of whether it's running.

## Checking Package Version

On Debian/Ubuntu:

```bash
# Check installed package version
dpkg -l | grep postgresql

# More specific
dpkg -l postgresql postgresql-14
```

On Red Hat/CentOS:

```bash
# Check installed package
rpm -qa | grep postgresql

# Or with yum
yum list installed | grep postgresql
```

This shows the version of the PostgreSQL package installed via the system package manager.

## Checking for Running Server

Verify PostgreSQL is running and which version:

```bash
# Check systemd service status
systemctl status postgresql

# Check running process
ps aux | grep postgres

# Show listening port and version
sudo netstat -tlnp | grep postgres
```

## Checking from Within Application Code

**Python (psycopg2):**

```python
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="mydb",
    user="postgres",
    password="password"
)

cur = conn.cursor()
cur.execute("SELECT version();")
version = cur.fetchone()[0]
print(version)

conn.close()
```

**Node.js (pg):**

```javascript
const { Client } = require('pg');

const client = new Client({
    host: 'localhost',
    database: 'mydb',
    user: 'postgres',
    password: 'password'
});

client.connect();

client.query('SELECT version()', (err, res) => {
    if (err) throw err;
    console.log(res.rows[0].version);
    client.end();
});
```

**Ruby (pg gem):**

```ruby
require 'pg'

conn = PG.connect(
    host: 'localhost',
    dbname: 'mydb',
    user: 'postgres',
    password: 'password'
)

result = conn.exec('SELECT version()')
puts result.getvalue(0, 0)

conn.close
```

## Getting Major Version Only

Extract just the major version number (e.g., "14" from "14.8"):

```bash
psql -t -c "SHOW server_version;" | cut -d. -f1 | tr -d ' '
```

Or with SQL:

```sql
SELECT split_part(version(), ' ', 2) AS version_number;
```

For programmatic use:

```bash
PGVERSION=$(psql -t -c "SHOW server_version;" | cut -d. -f1 | tr -d ' ')
echo "Major version: $PGVERSION"
```

## Checking Multiple Clusters

If you have multiple PostgreSQL clusters:

```bash
# List all clusters (on Debian/Ubuntu)
pg_lsclusters

# Connect to specific cluster
psql --cluster 14/main -c "SHOW server_version;"
```

## Checking Remote Server

Connect to a remote PostgreSQL server:

```bash
psql -h remote.example.com -U username -d database -c "SELECT version();"
```

Or set environment variables:

```bash
export PGHOST=remote.example.com
export PGUSER=username
export PGDATABASE=database
psql -c "SELECT version();"
```

## Version Information in Scripts

Create a version check script:

```bash
#!/bin/bash

echo "=== PostgreSQL Version Information ==="

echo "Client version:"
psql --version

echo ""
echo "Server version (full):"
psql -t -c "SELECT version();"

echo ""
echo "Server version (short):"
psql -t -c "SHOW server_version;"

echo ""
echo "Major version:"
psql -t -c "SHOW server_version;" | cut -d. -f1 | tr -d ' '
```

## Checking Version Compatibility

Compare client and server versions:

```bash
#!/bin/bash

CLIENT_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
SERVER_VERSION=$(psql -t -c "SHOW server_version;" | cut -d. -f1 | tr -d ' ')

echo "Client major version: $CLIENT_VERSION"
echo "Server major version: $SERVER_VERSION"

if [ "$CLIENT_VERSION" != "$SERVER_VERSION" ]; then
    echo "WARNING: Client and server versions don't match!"
fi
```

## Common PostgreSQL Versions

Understanding version numbers:

- PostgreSQL 14.8: Major version 14, minor version 8
- PostgreSQL 13.11: Major version 13, minor version 11
- PostgreSQL 12.15: Major version 12, minor version 15

Major versions introduce new features and break compatibility. Minor versions are bug fixes and security updates within the same major version.

## Checking Available Versions

See what PostgreSQL versions are available:

```bash
# Ubuntu/Debian
apt-cache search postgresql | grep "^postgresql-[0-9]"

# Red Hat/CentOS
yum search postgresql | grep "postgresql[0-9]"
```

## Troubleshooting Version Checks

If commands fail:

**"psql: command not found"**

PostgreSQL client isn't installed or not in PATH:

```bash
# Find psql location
which psql
sudo find / -name psql 2>/dev/null

# Add to PATH
export PATH=$PATH:/usr/lib/postgresql/14/bin
```

**"could not connect to server"**

PostgreSQL server isn't running:

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Check status
sudo systemctl status postgresql
```

**Connection refused:**

Check if PostgreSQL is listening:

```bash
sudo netstat -tlnp | grep 5432
sudo ss -tlnp | grep 5432
```

## Version-Specific Features

Knowing your version helps you understand what features are available:

- **PostgreSQL 14**: Multirange types, pg_stat_statements improvements
- **PostgreSQL 13**: Parallel queries, B-tree improvements
- **PostgreSQL 12**: Generated columns, partitioning improvements
- **PostgreSQL 11**: Stored procedures, parallelization enhancements

Check the official release notes for your version to see what features you have access to.

## Upgrading PostgreSQL

Once you know your version, you might want to upgrade:

```bash
# Check current version
psql -c "SHOW server_version;"

# See available versions
apt-cache search postgresql | grep "^postgresql-[0-9]"

# Install new version (doesn't auto-upgrade data)
sudo apt install postgresql-15

# Migrate data (requires careful planning)
pg_upgrade ...
```

Note: Upgrading requires careful planning and data migration. Always backup first.

To check your PostgreSQL version, use `psql --version` for the client or `psql -c "SELECT version();"` for the server. The server version is what determines compatibility and available features, so that's usually the one you need to know.
