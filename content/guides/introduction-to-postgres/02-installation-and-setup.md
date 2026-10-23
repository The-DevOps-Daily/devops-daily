---
title: How to Install PostgreSQL 18 and psql
description: 'Install PostgreSQL 18 on Ubuntu, Debian, RHEL, macOS, Windows or Docker, or only the psql client. Add psql to your PATH and create your first database.'
order: 2
---

**TLDR**: On Ubuntu or Debian, add the official PGDG repository and run `sudo apt install postgresql-18`. On macOS, run `brew install postgresql@18`. On Windows, use the EDB installer or `winget`. With Docker, run `postgres:18` and mount the volume at `/var/lib/postgresql`. If you only need the `psql` client, install `postgresql-client` (Linux), `libpq` (macOS) or the command line tools (Windows). Then connect with `psql`, create a database and a role with limited rights for your app.

This part gets PostgreSQL running on your machine and shows you how to talk to it. You install the server (or only the client), check that it accepts connections, learn the `psql` commands you will use every day, create your first database and table, and set up an application role that cannot drop your data.

## Prerequisites

- A Linux, macOS or Windows machine where you can run commands as an administrator (`sudo` or an elevated PowerShell).
- Or Docker, if you do not want to install PostgreSQL on the host.
- Basic comfort with a terminal. [Part 1](/guides/introduction-to-postgres/01-database-fundamentals) explains the database concepts used here.

## Which Version to Install

Install **PostgreSQL 18** for new projects. As of October 2026 the current release is 18.6. The PostgreSQL project ships one major version a year and minor (bug fix and security) releases every three months. Each major version gets five years of fixes:

| Version | Status (October 2026)                              |
| ------- | -------------------------------------------------- |
| 19      | Release candidate. Do not use it in production yet |
| 18      | Current. Supported until November 2030             |
| 15-17   | Supported                                          |
| 14      | End of life on 12 November 2026                    |
| 13      | End of life since November 2025                    |

Minor upgrades (18.5 to 18.6) only replace binaries. Major upgrades (17 to 18) change the on-disk format and need `pg_upgrade` or a dump and restore. [Part 10](/guides/introduction-to-postgres/10-production-best-practices) covers major upgrades.

## Installing PostgreSQL

Pick your platform. Each tab gives you a PostgreSQL 18 server plus the client tools (`psql`, `pg_dump`, `pg_restore`, `pg_isready`); with Docker, the tools are inside the container.

```tabs
{
  "title": "Install the PostgreSQL 18 server",
  "tabs": [
    {
      "label": "Ubuntu / Debian",
      "lang": "bash",
      "code": "# Add the official PostgreSQL (PGDG) apt repository\nsudo apt update\nsudo apt install -y postgresql-common\nsudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh\n\n# Install the server, client and contrib extensions\nsudo apt install -y postgresql-18\n\n# The default cluster starts automatically\npg_lsclusters"
    },
    {
      "label": "RHEL / Rocky / Alma",
      "lang": "bash",
      "code": "# RHEL, Rocky Linux or AlmaLinux 9 (use EL-10 for version 10,\n# and aarch64 instead of x86_64 on ARM)\nsudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm\n\n# On EL 8 only, disable the built-in module first:\n# sudo dnf -qy module disable postgresql\n\nsudo dnf install -y postgresql18-server postgresql18-contrib\nsudo /usr/pgsql-18/bin/postgresql-18-setup initdb\nsudo systemctl enable --now postgresql-18"
    },
    {
      "label": "Fedora",
      "lang": "bash",
      "code": "# Fedora 43 and 44 ship PostgreSQL 18 in their own repositories\nsudo dnf install -y postgresql-server postgresql-contrib\nsudo postgresql-setup --initdb\nsudo systemctl enable --now postgresql"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "brew install postgresql@18\n\n# postgresql@18 is keg-only, so put its tools on your PATH\n# (Apple silicon path; Intel Macs use /usr/local/opt/postgresql@18/bin)\necho 'export PATH=\"/opt/homebrew/opt/postgresql@18/bin:$PATH\"' >> ~/.zshrc\nsource ~/.zshrc\n\n# Start the server now and at every login\nbrew services start postgresql@18"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Option 1: winget (installs the EDB build)\nwinget install --id PostgreSQL.PostgreSQL.18 -e\n\n# Option 2: Chocolatey\nchoco install postgresql18 --params '/Password:change-me'\n\n# Option 3: download the graphical installer from\n# https://www.postgresql.org/download/windows/"
    },
    {
      "label": "Docker",
      "lang": "bash",
      "code": "docker run --name pg18 \\\n  -e POSTGRES_PASSWORD=change-me \\\n  -p 5432:5432 \\\n  -v pgdata:/var/lib/postgresql \\\n  -d postgres:18\n\n# Open psql inside the container\ndocker exec -it pg18 psql -U postgres"
    }
  ]
}
```

The notes below explain what each method sets up and where it differs.

### On Ubuntu/Debian

Ubuntu and Debian ship PostgreSQL in their own repositories, but often an older major version. The PGDG repository, run by the PostgreSQL project, always has the current one. The `apt.postgresql.org.sh` script adds the repository and its signing key, then asks you to confirm.

The package creates and starts a **cluster** called `main`: one server instance with its own data directory and port. Debian's tools manage clusters by version and name:

```bash
pg_lsclusters                          # list clusters
sudo systemctl status postgresql@18-main
sudo pg_ctlcluster 18 main restart     # restart one cluster
```

`pg_lsclusters` prints a line like this (example output):

```text
Ver Cluster Port Status Owner    Data directory              Log file
18  main    5432 online postgres /var/lib/postgresql/18/main /var/log/postgresql/postgresql-18-main.log
```

Contrib extensions such as `pg_stat_statements` and `pgcrypto` are part of the `postgresql-18` package. There is no separate contrib package to install.

### On Red Hat/CentOS/Fedora

CentOS Linux has reached end of life, so use RHEL, Rocky Linux or AlmaLinux. These systems do not create a cluster during the package install: you run `postgresql-18-setup initdb` once, then enable the `postgresql-18` service. The PGDG packages put the binaries in `/usr/pgsql-18/bin` and the data in `/var/lib/pgsql/18/data`.

On Fedora, the distribution packages are current enough, and the service is called `postgresql`.

### On macOS

Homebrew's `postgresql@18` formula is **keg-only**. Homebrew does not link its binaries into `/opt/homebrew/bin`, so `psql` is not found until you add the formula's `bin` directory to your `PATH`. The `brew install` output prints the exact line for your shell.

Homebrew runs `initdb` as your macOS user. That makes your macOS user name the superuser, and there is no `postgres` role. Connect with `psql postgres` (your user name, the `postgres` database).

If you prefer an app with a menu bar icon, [Postgres.app](https://postgresapp.com/) bundles several PostgreSQL versions and the client tools.

### On Windows

The Windows packages all install the EDB build. The graphical installer asks you for:

1. The components: PostgreSQL Server, pgAdmin 4, Stack Builder and Command Line Tools.
2. The data directory (the default is fine).
3. A password for the `postgres` superuser. Store it in your password manager.
4. The port (keep 5432 unless something else uses it).

The installer registers a Windows service that starts at boot. It does not add `psql` to your `PATH`. See [Add psql to Your PATH](#h2-add-psql-to-your-path).

### Using Docker

Docker is the fastest way to get a disposable PostgreSQL for development. The official `postgres` image takes its first-run settings from environment variables: `POSTGRES_PASSWORD` (required), `POSTGRES_USER` (default `postgres`) and `POSTGRES_DB` (default: the user name).

:::warning
From PostgreSQL 18, the official image stores data in `/var/lib/postgresql/18/docker` and declares the volume at `/var/lib/postgresql`. Mount your volume at `/var/lib/postgresql`, as shown above. The old `-v pgdata:/var/lib/postgresql/data` mount from tutorials for version 17 and older makes the 18 image exit with an error. If a volume does not cover the data directory, your data lives in the container's writable layer and is gone when you remove the container.
:::

Pin a major version tag such as `postgres:18`, not `latest`. When PostgreSQL 19 ships, `latest` moves to 19, and a 19 server cannot start on an 18 data directory.

## Install Only the psql Client

Many people only need `psql` (and often `pg_dump`) to connect to a server that runs somewhere else: a managed database, a Docker container or a colleague's machine. You do not need the server for that:

```tabs
{
  "title": "Install psql, pg_dump and pg_restore without the server",
  "tabs": [
    {
      "label": "Ubuntu / Debian",
      "lang": "bash",
      "code": "# Version from your distribution\nsudo apt install -y postgresql-client\n\n# Or, after adding the PGDG repository (see above), the current major\nsudo apt install -y postgresql-client-18"
    },
    {
      "label": "RHEL / Fedora",
      "lang": "bash",
      "code": "# PGDG repository (RHEL, Rocky, Alma)\nsudo dnf install -y postgresql18\n\n# Fedora's own packages\nsudo dnf install -y postgresql"
    },
    {
      "label": "macOS",
      "lang": "bash",
      "code": "# libpq contains psql, pg_dump, pg_restore and pg_isready\nbrew install libpq\n\n# libpq is keg-only too\necho 'export PATH=\"/opt/homebrew/opt/libpq/bin:$PATH\"' >> ~/.zshrc\nsource ~/.zshrc"
    },
    {
      "label": "Windows",
      "lang": "powershell",
      "code": "# Chocolatey: PostgreSQL 18 client tools only\n# (psql, pg_dump, pg_dumpall, pg_restore)\nchoco install psql18\n\n# Or run the EDB installer and select only \"Command Line Tools\""
    },
    {
      "label": "Docker",
      "lang": "bash",
      "code": "# Run psql from the image without installing anything\ndocker run --rm -it postgres:18 \\\n  psql \"postgresql://user@db.example.com:5432/appdb\""
    }
  ]
}
```

Two version rules help you pick the client:

- `psql` connects to servers older and newer than itself, but some backslash commands only fully support servers up to its own version. Use a client at least as new as your newest server.
- `pg_dump` must be the same major version as the server or newer. A `pg_dump` 16 refuses to dump a PostgreSQL 18 server.

## Add psql to Your PATH

If your shell says `psql: command not found` (or `'psql' is not recognized` on Windows), the tools are installed but not on your `PATH`:

| Platform                | Where the tools are                                                 |
| ----------------------- | ------------------------------------------------------------------- |
| Debian/Ubuntu           | `/usr/bin/psql` (a wrapper that picks the newest installed version) |
| RHEL with PGDG packages | `/usr/pgsql-18/bin`                                                 |
| macOS, Homebrew server  | `/opt/homebrew/opt/postgresql@18/bin` (Intel: `/usr/local/opt/...`) |
| macOS, Homebrew `libpq` | `/opt/homebrew/opt/libpq/bin`                                       |
| Windows                 | `C:\Program Files\PostgreSQL\18\bin`                                |

On Linux and macOS, add a line to your shell profile (`~/.bashrc` or `~/.zshrc`) and open a new terminal:

```bash
export PATH="/usr/pgsql-18/bin:$PATH"
```

On Windows, add the folder to your user `PATH` in PowerShell, then open a new terminal:

```powershell
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$userPath;C:\Program Files\PostgreSQL\18\bin", 'User')
```

You can also use **Settings > System > About > Advanced system settings > Environment Variables**.

On Debian and Ubuntu, server programs such as `pg_ctl` and `initdb` live in `/usr/lib/postgresql/18/bin` and are not on the `PATH` on purpose. Use `pg_ctlcluster` and `systemctl` instead.

## Verifying Installation

Check the client version and ask the server if it accepts connections:

```terminal
{
  "title": "check the install",
  "prompt": "$",
  "steps": [
    {
      "cmd": "psql --version",
      "output": "psql (PostgreSQL) 18.6 (Debian 18.6-1.pgdg12+2)"
    },
    {
      "cmd": "pg_isready -h localhost",
      "output": "localhost:5432 - accepting connections"
    },
    {
      "cmd": "pg_isready -h localhost -p 5433",
      "output": "localhost:5433 - no response"
    }
  ]
}
```

`psql --version` shows the build you installed. This output comes from the PGDG Debian package; Homebrew and EDB builds print their own suffix. `pg_isready` exits with code 0 when the server accepts connections. "no response" means nothing listens on that host and port. "rejecting connections" means the server is still starting or shutting down.

## Understanding PostgreSQL's Structure

A fresh installation gives you:

- **A cluster**: one running server (the `postgres` process) with one data directory. A cluster holds many databases.
- **The `postgres` role**: a superuser that can do anything. On Linux, the packages also create a `postgres` operating system user. Homebrew uses your macOS user instead.
- **The `postgres` database**: an empty default database to connect to.
- **`template1` and `template0`**: `CREATE DATABASE` copies `template1`. `template0` stays pristine so you can always create a clean database.
- **Configuration files**: `postgresql.conf` (server settings) and `pg_hba.conf` (who may connect and how).

Where things live depends on how you installed:

| Install method       | Data directory                        | Config files               |
| -------------------- | ------------------------------------- | -------------------------- |
| Debian/Ubuntu        | `/var/lib/postgresql/18/main`         | `/etc/postgresql/18/main/` |
| RHEL (PGDG)          | `/var/lib/pgsql/18/data`              | in the data directory      |
| Homebrew             | `/opt/homebrew/var/postgresql@18`     | in the data directory      |
| Windows (EDB)        | `C:\Program Files\PostgreSQL\18\data` | in the data directory      |
| Docker `postgres:18` | `/var/lib/postgresql/18/docker`       | in the data directory      |

Ask a running server with `SHOW data_directory;` and `SHOW config_file;`.

## Connecting to PostgreSQL

### Using psql (Command-Line Client)

`psql` is the standard PostgreSQL client. How you open it the first time depends on the platform:

```bash
# Linux packages: become the postgres OS user, then connect over the local socket
sudo -u postgres psql

# macOS with Homebrew: your user is the superuser
psql postgres

# Docker
docker exec -it pg18 psql -U postgres

# Any server over TCP (prompts for the password)
psql -h localhost -U postgres
```

On Windows, open **SQL Shell (psql)** from the Start menu, or run `psql -U postgres` once `psql` is on your `PATH`.

On Linux, `sudo -u postgres psql` works without a password because of **peer authentication**: for local socket connections, PostgreSQL checks that your operating system user name matches the database role name. You will see this rule in `pg_hba.conf` later in this part.

A first session looks like this. `\conninfo` shows where you are connected, and since PostgreSQL 18 it prints a table:

```terminal
{
  "title": "psql",
  "prompt": "postgres=#",
  "steps": [
    {
      "prompt": "$",
      "cmd": "psql -h localhost -U postgres",
      "output": "psql (18.6 (Debian 18.6-1.pgdg12+2))\nType \"help\" for help."
    },
    {
      "cmd": "\\conninfo",
      "output": "      Connection Information\n      Parameter       |   Value\n----------------------+-----------\n Database             | postgres\n Client User          | postgres\n Host                 | localhost\n Host Address         | 127.0.0.1\n Server Port          | 5432\n Options              |\n Protocol Version     | 3.0\n Password Used        | false\n GSSAPI Authenticated | false\n Backend PID          | 42\n SSL Connection       | false\n Superuser            | on\n Hot Standby          | off\n(13 rows)"
    }
  ]
}
```

This capture comes from a test server that accepts local TCP connections without a password, so `Password Used` is `false`. With the default `scram-sha-256` rules, `psql` first prints `Password for user postgres:`, and the row reads `true`.

### psql Basics

Commands that start with a backslash are **meta-commands**. psql handles them itself; they are not SQL, and they do not need a semicolon. Everything else is SQL and runs when you end it with `;`.

| Command       | What it does                                 |
| ------------- | -------------------------------------------- |
| `\l`          | List databases                               |
| `\c dbname`   | Connect to another database                  |
| `\dt`         | List tables in the current database          |
| `\d name`     | Describe a table, view, index or sequence    |
| `\dn`         | List schemas                                 |
| `\du`         | List roles                                   |
| `\df`         | List functions                               |
| `\x`          | Toggle expanded output (one column per line) |
| `\timing`     | Show how long each query takes               |
| `\e`          | Edit the last query in `$EDITOR`             |
| `\i file.sql` | Run SQL from a file                          |
| `\copy`       | Import or export CSV from the client side    |
| `\?` and `\h` | Help for meta-commands and for SQL commands  |
| `\q`          | Quit (Ctrl+D also works)                     |

Two habits save time: press Tab to complete table and column names, and use `\x auto` so wide rows switch to expanded output automatically.

### Connection String Format

Every client library and most tools accept a connection URI:

```text
postgresql://username:password@hostname:5432/database?sslmode=require
```

```bash
# Local connection
psql "postgresql://postgres@localhost/blog"

# Remote connection that requires TLS
psql "postgresql://app_user@db.example.com:5432/production?sslmode=require"
```

Keep passwords out of the URI when you type it in a shell, because it ends up in your shell history. Use a `.pgpass` file (below) instead. If a password contains characters such as `@`, `:` or `/`, percent-encode them in the URI (`@` becomes `%40`).

## Creating Your First Database

Create a database for a small blog, connect to it, and add a table. The `id` column uses an **identity column**, the SQL-standard way to generate keys. [Part 4](/guides/introduction-to-postgres/04-database-design-and-schemas) explains why it replaces `SERIAL`.

```terminal
{
  "title": "your first database",
  "prompt": "postgres=#",
  "steps": [
    {
      "cmd": "CREATE DATABASE blog;",
      "output": "CREATE DATABASE"
    },
    {
      "cmd": "\\c blog",
      "output": "You are now connected to database \"blog\" as user \"postgres\"."
    },
    {
      "prompt": "blog=#",
      "cmd": "CREATE TABLE posts (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  title text NOT NULL,\n  body text,\n  created_at timestamptz NOT NULL DEFAULT now()\n);",
      "output": "CREATE TABLE"
    },
    {
      "prompt": "blog=#",
      "cmd": "\\dt",
      "output": "          List of tables\n Schema | Name  | Type  |  Owner\n--------+-------+-------+----------\n public | posts | table | postgres\n(1 row)"
    },
    {
      "prompt": "blog=#",
      "cmd": "\\d posts",
      "output": "                                    Table \"public.posts\"\n   Column   |           Type           | Collation | Nullable |           Default\n------------+--------------------------+-----------+----------+------------------------------\n id         | bigint                   |           | not null | generated always as identity\n title      | text                     |           | not null |\n body       | text                     |           |          |\n created_at | timestamp with time zone |           | not null | now()\nIndexes:\n    \"posts_pkey\" PRIMARY KEY, btree (id)"
    }
  ]
}
```

Insert a few rows and read them back:

```terminal
{
  "title": "insert and query",
  "prompt": "blog=#",
  "steps": [
    {
      "cmd": "INSERT INTO posts (title, body)\nVALUES\n  ('First post', 'Hello, PostgreSQL!'),\n  ('Second post', 'Learning databases is fun'),\n  ('Third post', 'psql is my new favorite tool');",
      "output": "INSERT 0 3"
    },
    {
      "cmd": "SELECT id, title, created_at FROM posts;",
      "output": " id |    title    |        created_at\n----+-------------+---------------------------\n  1 | First post  | 2026-10-23 14:08:08.85+00\n  2 | Second post | 2026-10-23 14:08:08.85+00\n  3 | Third post  | 2026-10-23 14:08:08.85+00\n(3 rows)"
    }
  ]
}
```

`INSERT 0 3` means three rows were inserted (the `0` is a leftover field that is always zero). The `created_at` values show `+00` because this session runs in UTC; you will see your own time zone.

## Creating a Non-Superuser

Your application should not connect as `postgres`. A superuser bypasses every permission check, so a bug or an SQL injection could drop tables or read other databases. Create a role that can only read and write data:

```sql
-- Run these as postgres while connected to the blog database
CREATE ROLE blog_app WITH LOGIN PASSWORD 'change-me';

GRANT CONNECT ON DATABASE blog TO blog_app;
GRANT USAGE ON SCHEMA public TO blog_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO blog_app;

-- Tables that postgres creates later get the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO blog_app;
```

Test the limits with `SET ROLE`, which switches the current session to `blog_app`:

```terminal
{
  "title": "what blog_app can and cannot do",
  "prompt": "blog=#",
  "steps": [
    {
      "cmd": "SET ROLE blog_app;",
      "output": "SET"
    },
    {
      "cmd": "INSERT INTO posts (title) VALUES ('Written by blog_app') RETURNING id;",
      "output": " id\n----\n  4\n(1 row)\n\nINSERT 0 1"
    },
    {
      "cmd": "CREATE TABLE should_fail (id int);",
      "output": "ERROR:  permission denied for schema public\nLINE 1: CREATE TABLE should_fail (id int);\n                     ^"
    },
    {
      "cmd": "DROP TABLE posts;",
      "output": "ERROR:  must be owner of table posts"
    },
    {
      "cmd": "RESET ROLE;",
      "output": "RESET"
    }
  ]
}
```

The role can write rows but cannot create or drop tables. Identity columns do not need a separate grant on their sequence; the `INSERT` privilege is enough. (Older `SERIAL` columns do need `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public`.)

`permission denied for schema public` is a PostgreSQL 15 change. Before version 15, every role could create tables in the `public` schema. New databases now give that right only to the database owner. If your application runs its own migrations, either make the app role the owner of a dedicated schema or grant `CREATE ON SCHEMA public` to a separate migration role.

Connect as the new role over TCP:

```bash
psql -h localhost -U blog_app -d blog
```

For read-only reporting users, PostgreSQL also has predefined roles: `GRANT pg_read_all_data TO analyst;` gives read access to every table in every schema.

## Using GUI Tools

`psql` is the fastest tool for quick checks and scripts. A graphical client helps you browse data and build queries.

### pgAdmin

pgAdmin is the PostgreSQL project's own GUI. It runs as a desktop app or in a browser. Download it from [pgadmin.org](https://www.pgadmin.org/), then add your server:

1. Right-click **Servers** and choose **Register > Server**.
2. On the **General** tab, enter a name such as "Local PostgreSQL".
3. On the **Connection** tab, enter host `localhost`, port `5432`, user `postgres` and the password.
4. Save. Your databases appear in the tree on the left.

### Other Tools

- **DBeaver**: free, open source, supports many databases.
- **DataGrip**: JetBrains' database IDE (paid).
- **TablePlus** and **Postico**: lightweight native clients for macOS (TablePlus also runs on Windows).

## Configuration Basics

The main settings file is `postgresql.conf`. These are the defaults you will tune first:

```sql
SELECT name, setting, unit, context
FROM pg_settings
WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'listen_addresses', 'port')
ORDER BY name;
```

```text
       name       |  setting  | unit |  context
------------------+-----------+------+------------
 listen_addresses | localhost |      | postmaster
 max_connections  | 100       |      | postmaster
 port             | 5432      |      | postmaster
 shared_buffers   | 16384     | 8kB  | postmaster
 work_mem         | 4096      | kB   | user
(5 rows)
```

`shared_buffers` is shown in 8 kB pages: 16384 pages is 128 MB. The `context` column tells you how a change takes effect: `postmaster` settings need a restart, `sighup` settings need a reload, and `user` settings can change per session.

You can edit `postgresql.conf` by hand or use `ALTER SYSTEM`, which writes to `postgresql.auto.conf` in the data directory:

```sql
ALTER SYSTEM SET work_mem = '16MB';
SELECT pg_reload_conf();

-- Which changed settings still wait for a restart?
SELECT name, setting FROM pg_settings WHERE pending_restart;
```

From the shell, reload or restart through the service manager:

```bash
sudo systemctl reload postgresql@18-main     # Debian/Ubuntu
sudo systemctl restart postgresql-18         # RHEL (PGDG)
brew services restart postgresql@18          # macOS
```

[Part 10](/guides/introduction-to-postgres/10-production-best-practices) covers memory and performance tuning for production.

## Authentication Configuration

`pg_hba.conf` (host-based authentication) decides who may connect, from where, and how they prove who they are. The Debian and Ubuntu packages ship rules like these:

```text
# TYPE  DATABASE  USER      ADDRESS         METHOD
local   all       postgres                  peer
local   all       all                       peer
host    all       all       127.0.0.1/32    scram-sha-256
host    all       all       ::1/128         scram-sha-256
```

PostgreSQL reads the file from top to bottom and uses the **first** line that matches the connection type, database, user and address. If that line's method fails, the connection fails. PostgreSQL does not try the next line.

```diagram
{
  "type": "branch",
  "nodes": [
    { "label": "Client connects", "sub": "socket or TCP, db, user, IP", "icon": "net", "tone": "blue" },
    { "label": "pg_hba.conf", "sub": "first matching line wins", "icon": "shield", "tone": "violet" },
    { "label": "Auth method", "sub": "peer, scram-sha-256, cert", "icon": "lock", "tone": "amber" }
  ],
  "branch": [
    { "label": "Method succeeds: session starts", "variant": "good" },
    { "label": "Fails or no line matches: rejected", "variant": "bad" }
  ]
}
```

The common methods:

- **peer**: local socket connections only. The operating system user must match the role name.
- **scram-sha-256**: password authentication. The password never travels in clear text, and the server stores only a salted hash. This is the default for new passwords.
- **cert**: the client proves its identity with a TLS client certificate.
- **reject**: refuse the connection. Useful as a final catch-all line.

:::warning
MD5 password authentication is deprecated in PostgreSQL 18 and will be removed in a future release. If an old guide tells you to put `md5` in `pg_hba.conf`, use `scram-sha-256` instead. PostgreSQL 18 warns you when a role still gets an MD5 password.
:::

This is the warning PostgreSQL 18 prints if a session still uses MD5 password hashing:

```terminal
{
  "title": "PostgreSQL 18 warns about MD5",
  "prompt": "blog=#",
  "steps": [
    {
      "cmd": "SET password_encryption = 'md5';",
      "output": "SET"
    },
    {
      "cmd": "ALTER ROLE blog_app PASSWORD 'change-me';",
      "output": "WARNING:  setting an MD5-encrypted password\nDETAIL:  MD5 password support is deprecated and will be removed in a future release of PostgreSQL.\nHINT:  Refer to the PostgreSQL documentation for details about migrating to another password type.\nALTER ROLE"
    },
    {
      "cmd": "RESET password_encryption;",
      "output": "RESET"
    },
    {
      "cmd": "ALTER ROLE blog_app PASSWORD 'change-me';",
      "output": "ALTER ROLE"
    }
  ]
}
```

To accept connections from other machines, PostgreSQL must listen on a network interface and `pg_hba.conf` must allow the client's address. In `postgresql.conf`:

```ini
listen_addresses = '*'    # default is 'localhost'
```

In `pg_hba.conf`, allow only the network that needs access:

```text
host    blog      blog_app  10.0.1.0/24     scram-sha-256
```

Then restart (for `listen_addresses`) or reload (for `pg_hba.conf` changes).

:::warning
Never add `host all all 0.0.0.0/0` to a server on the internet. Database ports are scanned constantly, and a weak password is all an attacker needs. Restrict the address range, put a firewall in front, and require TLS (`hostssl`) for traffic that leaves the machine.
:::

## Environment Variables

libpq, the C library under `psql` and many drivers, reads these variables, so you do not have to type the same flags again:

```bash
export PGHOST=localhost
export PGPORT=5432
export PGUSER=blog_app
export PGDATABASE=blog
```

Do not put the password in `PGPASSWORD` in your shell profile: other processes and your shell history can see it. Use a `~/.pgpass` file instead. Each line is `hostname:port:database:username:password`, and `*` matches anything:

```bash
cat >> ~/.pgpass << 'EOF'
localhost:5432:blog:blog_app:change-me
EOF

# libpq ignores the file unless only you can read it
chmod 0600 ~/.pgpass
```

On Windows the file is `%APPDATA%\postgresql\pgpass.conf`.

## Connecting from Programming Languages

Every major language has a mature driver. Each one below connects as `blog_app`, runs a parameterized query and prints the result. Always pass values as parameters (`%s`, `$1`) instead of building SQL strings, which prevents SQL injection.

```tabs
{
  "title": "Connect and query from your app",
  "tabs": [
    {
      "label": "Python (psycopg 3)",
      "lang": "python",
      "code": "# pip install \"psycopg[binary]\"\nimport psycopg\n\nwith psycopg.connect(\"postgresql://blog_app:change-me@localhost:5432/blog\") as conn:\n    rows = conn.execute(\n        \"SELECT id, title FROM posts WHERE id > %s ORDER BY id\", (0,)\n    ).fetchall()\n    for row in rows:\n        print(row)"
    },
    {
      "label": "Node.js (pg)",
      "lang": "javascript",
      "code": "// npm install pg, then save as app.mjs (ES module, top-level await)\nimport pg from 'pg';\n\nconst client = new pg.Client({\n  connectionString: 'postgresql://blog_app:change-me@localhost:5432/blog',\n});\n\nawait client.connect();\nconst { rows } = await client.query(\n  'SELECT id, title FROM posts WHERE id > $1 ORDER BY id',\n  [0]\n);\nconsole.log(rows);\nawait client.end();"
    },
    {
      "label": "Go (pgx v5)",
      "lang": "go",
      "code": "// go get github.com/jackc/pgx/v5\npackage main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"log\"\n\n\t\"github.com/jackc/pgx/v5\"\n)\n\nfunc main() {\n\tctx := context.Background()\n\tconn, err := pgx.Connect(ctx, \"postgresql://blog_app:change-me@localhost:5432/blog\")\n\tif err != nil {\n\t\tlog.Fatal(err)\n\t}\n\tdefer conn.Close(ctx)\n\n\tvar title string\n\terr = conn.QueryRow(ctx, \"SELECT title FROM posts WHERE id = $1\", 1).Scan(&title)\n\tif err != nil {\n\t\tlog.Fatal(err)\n\t}\n\tfmt.Println(title)\n}"
    }
  ]
}
```

In a real application, read the connection string from an environment variable or a secrets manager, and use a connection pool (`psycopg_pool`, `pg.Pool`, `pgxpool`) instead of one connection per request.

## Common Installation Issues

### psql: command not found

The client is installed but not on your `PATH`. See [Add psql to Your PATH](#h2-add-psql-to-your-path). On macOS with Homebrew this is the most common problem, because both `postgresql@18` and `libpq` are keg-only.

### Connection Refused

This is what `psql` prints when nothing listens on the host and port you asked for:

```terminal
{
  "title": "nothing listens on port 5433",
  "prompt": "$",
  "steps": [
    {
      "cmd": "psql -h localhost -p 5433 -U postgres",
      "output": "psql: error: connection to server at \"localhost\" (::1), port 5433 failed: Connection refused\n\tIs the server running on that host and accepting TCP/IP connections?\nconnection to server at \"localhost\" (127.0.0.1), port 5433 failed: Connection refused\n\tIs the server running on that host and accepting TCP/IP connections?"
    }
  ]
}
```

Check that the server runs (`systemctl status`, `brew services list`, `docker ps`), that you use the right port, and, for remote servers, that `listen_addresses` and the firewall allow the connection. Without `-h`, psql connects over a Unix socket instead, and the same problem reads like this:

```terminal
{
  "title": "no server on the default socket",
  "prompt": "$",
  "steps": [
    {
      "cmd": "psql -U postgres",
      "output": "psql: error: connection to server on socket \"/var/run/postgresql/.s.PGSQL.5432\" failed: No such file or directory\n\tIs the server running locally and accepting connections on that socket?"
    }
  ]
}
```

### Port Already in Use

If PostgreSQL fails to start because port 5432 is taken, find the other process:

```bash
sudo ss -ltnp | grep 5432      # Linux
sudo lsof -i :5432             # macOS and Linux
```

Often it is a second PostgreSQL install (for example Homebrew plus Postgres.app) or a Docker container. Stop one of them, or set another `port` in `postgresql.conf` and connect with `-p`.

### Permission Denied Errors

These authentication errors are the ones people hit most often (example messages):

```text
FATAL:  Peer authentication failed for user "postgres"
FATAL:  password authentication failed for user "blog_app"
FATAL:  role "alice" does not exist
FATAL:  database "alice" does not exist
```

- **Peer authentication failed**: you connected over the local socket as a different OS user. Use `sudo -u postgres psql`, or connect over TCP with `-h localhost` so a password rule applies.
- **Password authentication failed**: wrong password, or the role has no password yet. Set one with `\password blog_app` in psql (it does not echo the password or write it to the history).
- **Role does not exist**: psql uses your OS user name as the role name when you do not pass `-U`. Pass `-U postgres` or create a role with your name.
- **Database does not exist**: psql also uses the role name as the default database name. Pass a database, for example `psql postgres`.

### Can't Create Database

`ERROR:  permission denied to create database` means your role lacks the `CREATEDB` attribute. A superuser can grant it:

```sql
ALTER ROLE blog_app CREATEDB;
```

## Exploring the System Catalogs

PostgreSQL describes itself in system catalogs and in the standard `information_schema`. A few queries you will reuse:

```sql
-- Databases
SELECT datname FROM pg_database WHERE NOT datistemplate;

-- Columns of a table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'posts';

-- Size of the current database
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Largest tables, including indexes and TOAST data
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC
LIMIT 10;
```

## Common Mistakes

- **Mounting the Docker volume at the old path.** With `postgres:18`, mount `/var/lib/postgresql`, not `/var/lib/postgresql/data`.
- **Using `latest` as the Docker tag.** Pin the major version so an image update does not try to start a new major version on old data.
- **Letting the application connect as `postgres`.** Create a role with only the privileges it needs.
- **Opening port 5432 to the internet.** Restrict `pg_hba.conf` and the firewall to known networks, and use TLS.
- **Copying `md5` from old tutorials.** Use `scram-sha-256`.
- **Installing the full server when you only need the client.** `postgresql-client`, `libpq` or the Windows command line tools give you `psql` and `pg_dump`.

## Next Steps

You now have PostgreSQL 18 running (or a `psql` client that can reach a server), a `blog` database with a table, and an application role with limited rights. You know the `psql` meta-commands for finding your way around.

Next, in [SQL Basics and CRUD Operations](/guides/introduction-to-postgres/03-sql-basics-and-crud), you will write the queries you use every day: `SELECT`, `INSERT`, `UPDATE` and `DELETE`, with filters, sorting, aggregates and upserts.
