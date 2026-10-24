---
title: 'Bash Text Processing: printf, Here Docs, awk, sed and jq'
description: 'Text and data tools for Bash scripts: printf versus echo, here documents, command and process substitution, awk, sed, jq, xargs, curl and dates.'
order: 9
---

Bash's strength is gluing programs together, and most scripts spend their time handing text from one tool to the next. Knowing which job belongs to a Bash builtin and which to `awk`, `sed` or `jq` is what keeps a script short, correct and fast.

This part covers `printf` and why it replaces `echo` in scripts, here documents, command and process substitution, a text-processing toolbox for logs (`grep`, `cut`, `sort`, `uniq`, `awk`, `sed`), how much faster builtins and `awk` are than loops, JSON with `jq`, parallel work with `xargs` and `wait -n`, `curl` in scripts, and dates.

## Prerequisites

- [Parts 2 to 8](/guides/introduction-to-bash/02-bash-basics) of this guide, and the practice directory in `~/bash-practice`.
- `jq`, `curl` and `nc`. On Debian and Ubuntu: `sudo apt install jq curl netcat-openbsd`; on macOS, `jq` comes from Homebrew and `curl` and `nc` are preinstalled.
- `grep`, `find` and pipes at the level of [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface). System tools such as `ps`, `ss`, `tar` and `rsync` are covered in the [Linux guide](/guides/introduction-to-linux) and not repeated here.

## printf Instead of echo

`echo` is fine for fixed text at the prompt. In scripts it has two problems: what it does with options and backslashes depends on the shell, and it cannot print a value that looks like an option.

```terminal
{
  "title": "echo is not predictable",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "flag=\"-n\"; echo \"$flag\"; echo \"(that printed nothing)\"",
      "output": "(that printed nothing)"
    },
    {
      "cmd": "echo 'a\\tb'; sh -c \"echo 'a\\tb'\"",
      "output": "a\\tb\na\tb"
    },
    {
      "cmd": "bash -c 'echo -e \"a\\tb\"'; sh -c 'echo -e \"a\\tb\"'",
      "output": "a\tb\n-e a\tb"
    }
  ]
}
```

Bash's `echo` treated `-n` as an option and printed nothing, and dash's `echo` interprets `\t` itself and prints `-e` literally. `printf` behaves the same everywhere: the first argument is a format, and the format is reused until all arguments are used up.

```terminal
{
  "title": "printf formats",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '%s\\n' \"$flag\"",
      "output": "-n"
    },
    {
      "cmd": "printf '%-10s|%5s|%05.1f\\n' web-1 80 3.14159 db-1 5432 2.5",
      "output": "web-1     |   80|003.1\ndb-1      | 5432|002.5"
    },
    {
      "cmd": "printf '%d in hex is %x, octal %o\\n' 255 255 255",
      "output": "255 in hex is ff, octal 377"
    },
    {
      "comment": "%q quotes a value so Bash can read it back; %b expands backslash escapes in the argument",
      "cmd": "printf '%q\\n' \"client's files\" $'tab\\there'; printf '%b\\n' 'line1\\nline2'",
      "output": "client\\'s\\ files\n$'tab\\there'\nline1\nline2"
    },
    {
      "comment": "-v stores the result in a variable instead of printing it",
      "cmd": "printf -v padded '%03d' 7; echo \"$padded\"",
      "output": "007"
    }
  ]
}
```

Rules of thumb: `printf '%s\n' "$var"` to print a variable, a format string in single quotes, and never a variable as the format (`printf "$var"` misbehaves when the value contains `%`). To write to standard error, add `>&2` ([echo to stderr](/posts/echo-to-stderr-in-bash)).

## Here Documents and Here Strings

A **here document** feeds the lines between `<<WORD` and a line containing only `WORD` to a command's standard input. [How cat <<EOF works](/posts/how-cat-eof-works-in-bash) explains the mechanics; the variants that matter in scripts:

| Form          | Effect                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| `<<EOF`       | Variables and `$(...)` are expanded; `\` escapes `$`, `` ` `` and `\`      |
| `<<'EOF'`     | Nothing is expanded (quote any part of the word: `'EOF'`, `"EOF"`, `\EOF`) |
| `<<-EOF`      | Leading **tab** characters are removed, so the text can be indented        |
| `<<< "$text"` | A **here string**: one string, plus a newline, as standard input           |

Here documents are the clearest way to send a block of commands or text to another program. For example, to run several commands on a remote server in one `ssh` connection, or to give `psql` a query:

```bash
# the quoted 'EOF' keeps $HOSTNAME for the remote shell to expand
ssh deploy@web-1.example.com bash -s <<'EOF'
set -e
cd /srv/notes-api
echo "deploying on $HOSTNAME"
EOF

psql "$DATABASE_URL" <<SQL
SELECT count(*) FROM orders WHERE created_at > now() - interval '1 day';
SQL
```

To put a multi-line text into a variable, use `read -d ''` or `$(cat <<'EOF' ... EOF)`. Note that `read -d ''` returns status 1 when it reaches the end of the input, which stops a script under `set -e` unless you add `|| true`:

```terminal
{
  "title": "a here document into a variable",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "read -r -d '' banner <<'EOF'\nNotes API maintenance\nBack at 10:00 UTC\nEOF"
    },
    {
      "cmd": "echo \"read exit status: $?\"; printf '%s\\n' \"$banner\"",
      "output": "read exit status: 1\nNotes API maintenance\nBack at 10:00 UTC"
    },
    {
      "cmd": "bash -ec \"read -r -d '' x <<< 'hello'; echo 'not reached'\"; echo \"with set -e: exit $?\"",
      "output": "with set -e: exit 1"
    }
  ]
}
```

## Command Substitution

`$(command)` runs a command and becomes its output. The old form with backticks, `` `command` ``, still works but needs backslashes to nest and treats backslashes inside it differently, so use `$( )`:

```terminal
{
  "title": "$( ) nests cleanly",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo \"directory name: $(basename \"$(dirname \"$PWD/logs/access.log\")\")\"",
      "output": "directory name: logs"
    },
    {
      "cmd": "echo \"with backticks: `basename \\`dirname $PWD/logs/access.log\\``\"",
      "output": "with backticks: logs"
    }
  ]
}
```

Three details of command substitution cause surprises:

```terminal
{
  "title": "what command substitution does to output",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "x=$(printf 'line\\n\\n\\n'); echo \"length ${#x}: trailing newlines are removed\"",
      "output": "length 4: trailing newlines are removed"
    },
    {
      "comment": "keep them by adding a character and removing it again",
      "cmd": "x=$(printf 'line\\n\\n\\n'; echo .); x=${x%.}; echo \"length ${#x}\"",
      "output": "length 7"
    },
    {
      "cmd": "x=$(printf 'a\\0b'); echo \"[$x]\"",
      "output": "bash: warning: command substitution: ignored null byte in input\n[ab]"
    },
    {
      "comment": "the exit status of an assignment is the status of the command",
      "cmd": "out=$(grep -c ' 503 ' logs/access.log); echo \"status $?, output $out\"",
      "output": "status 1, output 0"
    }
  ]
}
```

Null bytes cannot be stored in a variable at all; Bash drops them with a warning. Keep binary data in files.

## Process Substitution

`<(command)` runs a command and gives you a **file name** (a pipe under `/dev/fd`) that reads its output. Use it wherever a program wants a file but you have a command:

```terminal
{
  "title": "commands where files are expected",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo <(true)",
      "output": "/dev/fd/63"
    },
    {
      "cmd": "printf '%s\\n' web-1 web-2 db-1 > old.txt; printf '%s\\n' web-2 db-1 db-2 > new.txt"
    },
    {
      "cmd": "diff <(sort old.txt) <(sort new.txt)",
      "output": "2c2\n< web-1\n---\n> db-2"
    },
    {
      "comment": "comm: only in old, only in new, in both (inputs must be sorted)",
      "cmd": "comm <(sort old.txt) <(sort new.txt)",
      "output": "\t\tdb-1\n\tdb-2\nweb-1\n\t\tweb-2"
    },
    {
      "comment": ">(...) works the other way: write to a command as if it were a file",
      "cmd": "tee >(gzip > requests.gz) < logs/access.log > /dev/null; wait $!; zcat requests.gz | wc -l",
      "output": "40"
    },
    {
      "cmd": "rm old.txt new.txt requests.gz"
    }
  ]
}
```

You have already used the most common form, `while read ... done < <(command)`, which keeps the loop in the current shell ([Part 5](/guides/introduction-to-bash/05-control-structures)). Process substitution is not part of POSIX: dash does not have it, and BusyBox `ash` has it only when built with Bash compatibility (Alpine's BusyBox 1.37 is). A `>(...)` command runs in the background, so `zcat` must not read `requests.gz` before `gzip` has finished writing it: `$!` holds the PID of the last process substitution, and `wait $!` waits for it.

## A Text Toolbox for Logs

Most log questions are answered by a pipeline of small tools. With the access log fields (1 is the IP, 4 the time, 6 the method with a leading quote, 7 the path, 9 the status and 10 the size):

```terminal
{
  "title": "answer questions about the access log",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cut -d' ' -f1 logs/access.log | sort | uniq -c | sort -rn | head -n 3",
      "output": "     12 198.51.100.23\n      9 203.0.113.77\n      8 203.0.113.10"
    },
    {
      "comment": "requests and bytes per path, with awk",
      "cmd": "awk '{ n[$7]++; bytes[$7] += $10 } END { for (p in n) printf \"%-20s %3d %7d\\n\", p, n[p], bytes[p] }' logs/access.log | sort -k3,3nr | head -n 4",
      "output": "/api/orders/1042       4    5160\n/api/users             4    2936\n/                      4    2448\n/index.html            4    2448"
    },
    {
      "comment": "server errors, with the time",
      "cmd": "awk '$9 >= 500 { print $4, $9, $7 }' logs/access.log | tr -d '['",
      "output": "23/Oct/2026:08:27:56 500 /api/health\n23/Oct/2026:08:39:15 500 /api/health\n23/Oct/2026:08:57:02 500 /api/health\n23/Oct/2026:09:14:49 500 /api/health"
    },
    {
      "cmd": "grep -oE '\"(GET|POST) [^ ]+' logs/access.log | sort | uniq -c | sort -rn | head -n 3",
      "output": "      4 \"POST /login\n      4 \"POST /api/orders\n      4 \"GET /wp-login.php"
    },
    {
      "comment": "lines 2 to 3 of a file, then a substitution, with sed",
      "cmd": "sed -n '2,3p' logs/app.log | sed -E 's/^([^ ]+) ([A-Z]+) +/[\\2] /'",
      "output": "[WARN] slow query took 1250 ms\n[ERROR] payment provider timeout order=1042"
    }
  ]
}
```

What each tool is for:

| Tool                 | Use it to                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| `grep`               | Keep or drop lines that match a pattern (`-v`, `-c`, `-o`, `-E`, `-F`) |
| `cut`                | Take fields by a single-character delimiter                            |
| `sort`               | Sort lines (`-n` numbers, `-r` reverse, `-k` by field, `-u` unique)    |
| `uniq -c`            | Count runs of identical lines (sort first)                             |
| `awk`                | Work with fields, sums, counts and conditions in one pass              |
| `sed`                | Edit text in a stream: substitute, delete or print line ranges         |
| `tr`                 | Replace or delete single characters                                    |
| `head`, `tail`, `wc` | Take the first or last lines, count lines, words and bytes             |

Ubuntu and Debian install `mawk` as `awk`, Fedora and macOS use different implementations. Stick to POSIX awk features (no `gensub`, `asort` or `strftime`) when a script must run everywhere.

`sed -i` (edit a file in place) is the classic portability trap: GNU sed takes an optional suffix attached to `-i`, BSD sed on macOS requires one as a separate argument:

```tabs
{
  "title": "Edit a file in place with sed",
  "tabs": [
    {
      "label": "Linux (GNU sed)",
      "lang": "bash",
      "code": "sed -i 's/LOG_LEVEL=info/LOG_LEVEL=debug/' config/app.env"
    },
    {
      "label": "macOS (BSD sed)",
      "lang": "bash",
      "code": "sed -i '' 's/LOG_LEVEL=info/LOG_LEVEL=debug/' config/app.env"
    },
    {
      "label": "Both",
      "lang": "bash",
      "code": "# write a new file and move it over the old one (also atomic, see Part 3)\nsed 's/LOG_LEVEL=info/LOG_LEVEL=debug/' config/app.env > config/app.env.new &&\n    mv config/app.env.new config/app.env"
    }
  ]
}
```

## Builtins, Loops and awk: How Much Faster

Every `$(...)` that runs an external command starts a new process, and inside a loop that adds up. Here are two jobs done three ways, timed with Bash's `time` keyword on a small four-core ARM machine (your numbers will differ; the ratios are the point):

```bash
#!/usr/bin/env bash
# speed.sh: compare a builtin, an external command and awk
TIMEFORMAT='%R s'
path="/var/log/nginx/access.log.2.gz"

echo "10,000 times basename, with the \${path##*/} expansion:"
time for (( i = 0; i < 10000; i++ )); do f=${path##*/}; done
echo "10,000 times basename, with \$(basename):"
time for (( i = 0; i < 10000; i++ )); do f=$(basename "$path"); done

# a 20,000-line log: the practice log repeated 500 times
big=$(mktemp) || exit 1
trap 'rm -f -- "$big"' EXIT
for (( i = 0; i < 500; i++ )); do cat logs/access.log; done > "$big"
source lib/logstat.sh
echo "count by status, Bash loop with a regex per line (count_by):"
time count_by status "$big" > /dev/null
echo "count by status, awk:"
time awk '{ n[$9]++ } END { for (s in n) print n[s], s }' "$big" > /dev/null
echo "$f"
```

```terminal
{
  "title": "the timings",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash speed.sh",
      "output": "10,000 times basename, with the ${path##*/} expansion:\n0.344 s\n10,000 times basename, with $(basename):\n38.924 s\ncount by status, Bash loop with a regex per line (count_by):\n17.657 s\ncount by status, awk:\n0.025 s\naccess.log.2.gz"
    }
  ]
}
```

The parameter expansion took about a third of a second; starting `basename` ten thousand times took almost 40 seconds, roughly 4 ms per process on this machine (timings vary between runs, the ratios stay). `awk` counted the 20,000 lines in a few hundredths of a second, while the Bash loop in `count_by`, with a regex match and an array update per line, took about 18 seconds. The lesson is not "never loop in Bash": `logstat` is fast enough for log files of a few thousand lines, and it is easy to read and test. But when a script processes large files, let one `awk`, `grep` or `sort` process read the whole file instead of running commands per line.

## JSON With jq

Do not parse JSON with `grep`, `sed` or `cut`: a reordered key, an escaped quote or a line break breaks them. `jq` parses it properly. Save a sample API response:

```json
{
  "region": "eu-west",
  "services": [
    { "name": "notes-api", "port": 8080, "healthy": true, "replicas": 3 },
    { "name": "worker", "port": 9090, "healthy": false, "replicas": 2 },
    { "name": "cache", "port": 6379, "healthy": true, "replicas": 1 }
  ]
}
```

```terminal
{
  "title": "query JSON with jq",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "jq --version",
      "output": "jq-1.7"
    },
    {
      "cmd": "jq -r '.services[] | select(.healthy | not) | .name' services.json",
      "output": "worker"
    },
    {
      "cmd": "jq -r '.services[] | \"\\(.name)\\t\\(.port)\"' services.json",
      "output": "notes-api\t8080\nworker\t9090\ncache\t6379"
    },
    {
      "cmd": "jq '[.services[].replicas] | add' services.json",
      "output": "6"
    },
    {
      "comment": "pass shell values with --arg, never by pasting them into the filter",
      "cmd": "name=\"worker\"; jq -r --arg n \"$name\" '.services[] | select(.name == $n) | .port' services.json",
      "output": "9090"
    },
    {
      "comment": "-e sets the exit status from the result, handy in if statements",
      "cmd": "if jq -e '.services[] | select(.name == \"cache\") | .healthy' services.json > /dev/null; then echo \"cache is healthy\"; fi",
      "output": "cache is healthy"
    },
    {
      "cmd": "mapfile -t names < <(jq -r '.services[].name' services.json); echo \"${#names[@]} services: ${names[*]}\"",
      "output": "3 services: notes-api worker cache"
    }
  ]
}
```

Build JSON with `jq -n` as well, so values are escaped correctly. A `printf` template breaks as soon as a value contains a quote:

```terminal
{
  "title": "generate JSON safely",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "msg='disk \"nearly\" full'; printf '{\"text\": \"%s\"}\\n' \"$msg\" | jq .",
      "output": "jq: parse error: Invalid numeric literal at line 1, column 23"
    },
    {
      "cmd": "jq -n --arg text \"$msg\" --argjson count 3 '{text: $text, count: $count}'",
      "output": "{\n  \"text\": \"disk \\\"nearly\\\" full\",\n  \"count\": 3\n}"
    }
  ]
}
```

The `jq` package in Ubuntu 24.04 is version 1.7.1, though it prints `jq-1.7`. The current release is jq 1.8.2 (June 2026), and Ubuntu 26.04 ships 1.8.1, which gives the same results for every filter in this part.

## Run Work in Parallel

`xargs -P` runs a command on several inputs at once. With `-0`, it reads the null-separated names that `find -print0` writes, so any file name is safe:

```terminal
{
  "title": "xargs -P",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "find logs files -type f -print0 | xargs -0 -n 1 -P 4 wc -l | sort -k2",
      "output": "1 files/.env\n2 files/data.csv\n1 files/monthly report.txt\n1 files/notes.txt\n1 files/photo.JPG\n40 logs/access.log\n6 logs/app.log"
    }
  ]
}
```

For Bash functions or more control, start jobs with `&` and limit how many run at once with `wait -n` (Bash 4.3+), which waits for any one job to finish:

```bash
#!/usr/bin/env bash
# parallel.sh: run 6 jobs, at most 3 at a time, and count the failures
max_jobs=3 running=0 failed=0

job() { # a stand-in for real work: sleep, fail on 5
    sleep 1
    (($1 != 5)) || return 1
    echo "job $1 done"
}

SECONDS=0
for n in 1 2 3 4 5 6; do
    if ((running >= max_jobs)); then
        wait -n || failed=$((failed + 1)) # collect one finished job
        running=$((running - 1))
    fi
    job "$n" &
    running=$((running + 1))
done
while ((running > 0)); do
    wait -n || failed=$((failed + 1))
    running=$((running - 1))
done
echo "finished in ${SECONDS}s, $failed job(s) failed"
```

```terminal
{
  "title": "three at a time",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash parallel.sh",
      "output": "job 2 done\njob 3 done\njob 1 done\njob 4 done\njob 6 done\nfinished in 2s, 1 job(s) failed"
    }
  ]
}
```

Six one-second jobs finished in about two seconds instead of six. The script counts its jobs itself: each `wait -n` collects exactly one finished job and returns its exit status, including jobs that ended before `wait -n` was called, so every failure is counted. GNU `parallel` is a more complete tool for the same job if you can install it.

## curl in Scripts

By default `curl` exits with 0 even when the server answers with an error such as 500, so a script cannot tell that the request failed. `--fail` (`-f`) turns HTTP errors into exit code 22. Here a one-line `nc` server returns a 500:

```terminal
{
  "title": "curl --fail",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf 'HTTP/1.1 500 Internal Server Error\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n' | nc -l 127.0.0.1 8081 > /dev/null & sleep 0.5; curl -s http://127.0.0.1:8081/health; echo \"without --fail: exit $?\"",
      "output": "without --fail: exit 0"
    },
    {
      "cmd": "printf 'HTTP/1.1 500 Internal Server Error\\r\\nContent-Length: 0\\r\\nConnection: close\\r\\n\\r\\n' | nc -l 127.0.0.1 8081 > /dev/null & sleep 0.5; curl -fsS http://127.0.0.1:8081/health; echo \"with --fail: exit $?\"",
      "output": "curl: (22) The requested URL returned error: 500\nwith --fail: exit 22"
    }
  ]
}
```

A good default for scripts is `curl -fsS --retry 3 --max-time 10`: fail on HTTP errors, no progress bar but still show errors, retry transient failures, and never hang. Newer curl versions (7.76+) also have `--fail-with-body`, which keeps the error response for logging.

## Dates and Times

GNU `date`, on Linux, parses and formats dates; macOS uses BSD `date`, which has different options:

```terminal
{
  "title": "GNU date and Bash's own time formatting",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "date -u -d '2026-10-23 08:15:00' +'%Y-%m-%dT%H:%M:%SZ'",
      "output": "2026-10-23T08:15:00Z"
    },
    {
      "cmd": "date -u -d '2026-10-23 +3 days' +%F; date -u -d @1792743300 +'%F %T'",
      "output": "2026-10-26\n2026-10-23 08:15:00"
    },
    {
      "comment": "Bash can format the current time without starting date",
      "cmd": "printf '%(%F)T is day %(%j)T of the year\\n' -1 -1 | sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}/YYYY-MM-DD/; s/day [0-9]+/day NNN/'",
      "output": "YYYY-MM-DD is day NNN of the year"
    }
  ]
}
```

The `sed` only hides today's date. The equivalents on macOS:

```tabs
{
  "title": "Date arithmetic on Linux and macOS",
  "tabs": [
    {
      "label": "Linux (GNU date)",
      "lang": "bash",
      "code": "date -u -d '2026-10-23 +3 days' +%F                         # 2026-10-26\ndate -u -d @1792743300 +'%F %T'                             # from epoch seconds\ndate -u -d '2026-10-23 08:15:00' +%s                        # to epoch seconds"
    },
    {
      "label": "macOS (BSD date)",
      "lang": "bash",
      "code": "date -u -j -v+3d -f '%Y-%m-%d' 2026-10-23 +%F               # 2026-10-26\ndate -u -r 1792743300 +'%F %T'                              # from epoch seconds\ndate -u -j -f '%Y-%m-%d %H:%M:%S' '2026-10-23 08:15:00' +%s # to epoch seconds"
    },
    {
      "label": "Any Bash 4.2+",
      "lang": "bash",
      "code": "printf '%(%F %T)T\\n' 1792743300                             # format epoch seconds\nprintf '%(%s)T\\n' -1                                        # now, in epoch seconds\necho \"$EPOCHSECONDS\"                                        # the same, Bash 5.0+"
    }
  ]
}
```

Use UTC (`-u`, or `TZ=UTC`) for timestamps in logs and file names: they sort correctly and do not jump at daylight saving changes. See [format a date as YYYY-MM-DD](/posts/format-date-yyyy-mm-dd-in-shell-script) and [the current time in seconds since the epoch](/posts/get-current-time-seconds-since-epoch-bash).

## Common Mistakes

- **`echo "$var"` for arbitrary values.** Use `printf '%s\n' "$var"`.
- **A variable as the `printf` format.** Put it in an argument: `printf '%s' "$var"`.
- **Backticks**, especially nested ones. Use `$( )`.
- **Forgetting that `$( )` strips trailing newlines** and drops null bytes.
- **Parsing JSON with `grep` or `sed`,** or building it with `printf`. Use `jq`.
- **A loop that starts a command for every line of a big file.** Use one `awk` or `grep`.
- **`sed -i` in a script that must run on macOS.** Write a new file and `mv` it.
- **`curl` without `--fail`** in a script that checks whether a request worked.

## Summary

- `printf` replaces `echo` in scripts; `%q` quotes, `-v` assigns.
- Here documents feed text blocks to commands; quote the delimiter to stop expansion, and remember `read -d ''` returns 1.
- `$( )` captures output without trailing newlines; `<( )` turns a command into a file name.
- `cut`, `sort`, `uniq -c` and `awk` answer most log questions in one line.
- Parameter expansion and one `awk` call beat per-line loops and external commands in loops by large factors.
- `jq` reads and writes JSON safely; `xargs -P` and `wait -n` run work in parallel; `curl -fsS` fails on HTTP errors.

Next: [Bash Best Practices](/guides/introduction-to-bash/10-bash-best-practices): strict mode and its traps, error handling, ShellCheck, tests with bats and portability.

## Keep Learning

- [How cat <<EOF works in Bash](/posts/how-cat-eof-works-in-bash)
- [Set a variable to the output of a command](/posts/set-variable-command-output-bash)
- [Send output to a file and to the screen](/posts/redirect-output-to-file-and-stdout)
- [Sleep for milliseconds](/posts/sleep-for-milliseconds)
- Interview questions: [grep and text search](/interview-questions/junior/linux-grep-text-search)
