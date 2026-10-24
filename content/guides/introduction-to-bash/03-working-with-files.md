---
title: 'Working With Files in Bash: Globs, Safe Loops and Temp Files'
description: 'Handle files safely in Bash: glob patterns and shopt options, names with spaces or dashes, find -print0 loops, file tests, reading lines, temp files, CRLF.'
order: 3
---

Most shell scripts exist to do something to files: rotate logs, archive a directory, rename a batch of images, read a list of servers. The commands that copy, move and delete files are simple. The hard part is handing them the right file names, all of them, and nothing else, even when a name contains a space, starts with a dash or does not exist yet.

This part covers the Bash side of file handling: wildcard patterns and the options that change them, file names that break scripts, safe loops over files, file tests, reading and writing files, temporary files and Windows line endings.

## Prerequisites

- The practice directory from [Part 1](/guides/introduction-to-bash/01-what-is-bash) and the expansion order from [Part 2](/guides/introduction-to-bash/02-bash-basics).
- The basic file commands (`cp`, `mv`, `rm`, `find`, `grep`) from [Linux command line basics](/guides/introduction-to-linux/03-command-line-interface). Permissions and links are in [the file system part](/guides/introduction-to-linux/04-file-system-hierarchy) of the Linux guide.

## Globbing: Wildcards in Depth

**Globbing** (pathname expansion) replaces a pattern with the names of matching files. Bash does it before the command runs, so `ls *.txt` gives `ls` a list of names, and `ls` never sees the `*`.

| Pattern       | Matches                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `*`           | Any string, including an empty one                                     |
| `?`           | Exactly one character                                                  |
| `[abc]`       | One of `a`, `b` or `c`; `[a-z]` is a range                             |
| `[!abc]`      | One character that is not `a`, `b` or `c` (`[^abc]` also works)        |
| `[[:digit:]]` | One character of a class: `alpha`, `digit`, `space`, `upper` and so on |

```terminal
{
  "title": "basic patterns",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo files/*",
      "output": "files/data.csv files/monthly report.txt files/notes.txt files/photo.JPG"
    },
    {
      "cmd": "echo files/*.txt",
      "output": "files/monthly report.txt files/notes.txt"
    },
    {
      "cmd": "echo files/?????.*",
      "output": "files/notes.txt files/photo.JPG"
    },
    {
      "cmd": "echo logs/a[!c]*.log",
      "output": "logs/app.log"
    },
    {
      "comment": "hidden files (names that start with a dot) are left out",
      "cmd": "echo files/.*",
      "output": "files/.env"
    }
  ]
}
```

Three rules explain most glob surprises:

- **Results are sorted** by name, using the current locale's order.
- **Hidden files are skipped** unless the pattern itself starts with a dot. Since Bash 5.2, `.*` no longer matches `.` and `..` (the `globskipdots` option).
- **A pattern that matches nothing stays as it is.** `files/*.pdf` with no PDF files is passed to the command as the literal text `files/*.pdf`.

The last rule bites in loops, which then run once with a name that does not exist. Two shell options change it:

```terminal
{
  "title": "when nothing matches",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "for f in files/*.pdf; do echo \"found: $f\"; done",
      "output": "found: files/*.pdf"
    },
    {
      "comment": "nullglob: a pattern without matches expands to nothing",
      "cmd": "shopt -s nullglob; for f in files/*.pdf; do echo \"found: $f\"; done; echo \"(loop ran zero times)\"",
      "output": "(loop ran zero times)"
    },
    {
      "cmd": "shopt -u nullglob"
    },
    {
      "comment": "failglob: a pattern without matches is an error, and the command does not run",
      "cmd": "shopt -s failglob"
    },
    {
      "cmd": "ls files/*.pdf; echo \"this echo is on the same line, so it is skipped too\"",
      "output": "bash: no match: files/*.pdf"
    },
    {
      "cmd": "shopt -u failglob"
    }
  ]
}
```

Use `nullglob` in scripts that loop over files, and turn it off again afterwards if later commands rely on the default (`ls *.pdf` with `nullglob` on and no PDFs runs a bare `ls`, which lists everything).

More options, all set with `shopt -s name`:

| Option       | Effect                                                               |
| ------------ | -------------------------------------------------------------------- |
| `dotglob`    | `*` also matches hidden files                                        |
| `nocaseglob` | Match without regard to case, so `*.jpg` finds `photo.JPG`           |
| `globstar`   | `**` matches any number of directories (Bash 4.0+)                   |
| `extglob`    | Extended patterns: `!(pat)`, `@(a\|b)`, `*(pat)`, `+(pat)`, `?(pat)` |

```terminal
{
  "title": "dotglob, nocaseglob, globstar, extglob",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "shopt -s dotglob; echo files/*; shopt -u dotglob",
      "output": "files/.env files/data.csv files/monthly report.txt files/notes.txt files/photo.JPG"
    },
    {
      "cmd": "shopt -s nocaseglob; echo files/*.jpg; shopt -u nocaseglob",
      "output": "files/photo.JPG"
    },
    {
      "cmd": "shopt -s globstar; echo **/*.log **/*.env; shopt -u globstar",
      "output": "logs/access.log logs/app.log config/app.env"
    },
    {
      "cmd": "shopt -s extglob"
    },
    {
      "comment": "everything in files/ except .txt files",
      "cmd": "echo files/!(*.txt)",
      "output": "files/data.csv files/photo.JPG"
    },
    {
      "cmd": "echo files/@(notes|data).*",
      "output": "files/data.csv files/notes.txt"
    }
  ]
}
```

`extglob` has a catch: Bash must see `shopt -s extglob` **before it parses** the line that uses the pattern. On one line, it is too late:

```terminal
{
  "title": "extglob must be on before the line is parsed",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash -c 'shopt -s extglob; echo files/!(*.txt)'",
      "output": "bash: -c: line 1: syntax error near unexpected token `('\nbash: -c: line 1: `shopt -s extglob; echo files/!(*.txt)'"
    },
    {
      "cmd": "bash -c 'shopt -s extglob\necho files/!(*.txt)'",
      "output": "files/data.csv files/photo.JPG"
    }
  ]
}
```

In a script, put `shopt -s extglob` on its own line near the top, before any function that uses extended patterns.

Bash 5.3 adds `GLOBSORT` to sort the results by something other than the name, for example the newest file first:

```terminal
{
  "title": "GLOBSORT in Bash 5.3.9",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "touch -d '2026-10-01' files/notes.txt; touch -d '2026-10-20' files/data.csv"
    },
    {
      "cmd": "GLOBSORT=-mtime; echo files/*",
      "output": "files/photo.JPG files/monthly report.txt files/data.csv files/notes.txt"
    },
    {
      "cmd": "GLOBSORT=size; echo files/*",
      "output": "files/notes.txt files/data.csv files/photo.JPG files/monthly report.txt"
    }
  ]
}
```

The `-` reverses the order, so `-mtime` lists the most recently modified file first. On older Bash, sort with `ls -t` (only for display) or `find -printf` instead.

### Braces Are Not Globs

Brace expansion looks similar but does something else: it generates words whether or not files exist. That makes it the right tool for creating names:

```terminal
{
  "title": "brace expansion creates names",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "echo files/{notes,missing}.txt",
      "output": "files/notes.txt files/missing.txt"
    },
    {
      "cmd": "mkdir -p project/{src,tests,docs} && echo project/*",
      "output": "project/docs project/src project/tests"
    },
    {
      "comment": "a quick backup copy: expands to cp config/app.env config/app.env.bak",
      "cmd": "cp config/app.env{,.bak} && ls config",
      "output": "app.env\napp.env.bak"
    },
    {
      "cmd": "rm -r project config/app.env.bak"
    }
  ]
}
```

## File Names That Break Scripts

Linux allows any character in a file name except `/` and the null byte: spaces, quotes, `*`, newlines and a leading `-` are all legal. Each one breaks a different kind of careless script.

**Spaces** split unquoted names into several arguments. **A leading dash** makes a name look like an option. Create a file called `-l` and watch `ls *` change its output format:

```terminal
{
  "title": "a file named -l",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cd files && touch -- -l"
    },
    {
      "cmd": "ls *",
      "output": "-rw-rw-r-- 1 dev dev 16 Oct 24 06:00 data.csv\n-rw-rw-r-- 1 dev dev 18 Oct 24 06:00 monthly report.txt\n-rw-rw-r-- 1 dev dev  9 Oct 24 06:00 notes.txt\n-rw-rw-r-- 1 dev dev 17 Oct 24 06:00 photo.JPG"
    },
    {
      "comment": "-- ends the options: everything after it is a file name",
      "cmd": "ls -- *",
      "output": "-l\ndata.csv\nmonthly report.txt\nnotes.txt\nphoto.JPG"
    },
    {
      "comment": "or make every name start with ./",
      "cmd": "ls ./*",
      "output": "./-l\n./data.csv\n./monthly report.txt\n./notes.txt\n./photo.JPG"
    },
    {
      "cmd": "rm ./-l; cd .."
    }
  ]
}
```

`ls *` expanded to `ls -l data.csv monthly report.txt ...`, and `ls` read `-l` as its long-listing option. A file called `-rf` in a directory where someone runs `rm *` does worse. Write `./*` or put `--` before file names whenever the names come from a glob or from user input; most commands, including `rm`, `cp`, `mv`, `grep` and `tar`, accept `--`.

**Never loop over `ls` output.** `$(ls)` is one string that Bash splits on whitespace, so a name with a space becomes two names:

```terminal
{
  "title": "for f in $(ls) splits names",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "for f in $(ls files); do echo \"[$f]\"; done",
      "output": "[data.csv]\n[monthly]\n[report.txt]\n[notes.txt]\n[photo.JPG]"
    },
    {
      "cmd": "for f in files/*; do echo \"[$f]\"; done",
      "output": "[files/data.csv]\n[files/monthly report.txt]\n[files/notes.txt]\n[files/photo.JPG]"
    }
  ]
}
```

## Loop Over Files Safely

For files in one directory, a glob with `nullglob` is all you need. For a whole tree, use `find` and separate the names with null bytes, the one character that cannot appear in a name. There are three good ways to consume `find` output:

```bash
#!/usr/bin/env bash
# count-lines.sh: three safe ways to process every file that find returns

echo "1. find -exec runs the command with many names at once:"
find . -name '*.log' -exec wc -l {} +

echo "2. a while loop reading null-separated names:"
total=0
while IFS= read -r -d '' file; do
    lines=$(wc -l < "$file")
    total=$(( total + lines ))
    printf '   %-28s %3d\n' "$file" "$lines"
done < <(find . -type f \( -name '*.log' -o -name '*.txt' \) -print0 | sort -z)
echo "   total: $total lines"

echo "3. mapfile into an array (Bash 4.4+ for -d ''):"
mapfile -d '' -t files < <(find files -type f -print0 | sort -z)
echo "   ${#files[@]} files, the third is [${files[2]}]"
```

```terminal
{
  "title": "run it",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash count-lines.sh",
      "output": "1. find -exec runs the command with many names at once:\n  40 ./logs/access.log\n   6 ./logs/app.log\n  46 total\n2. a while loop reading null-separated names:\n   ./files/monthly report.txt     1\n   ./files/notes.txt              1\n   ./logs/access.log             40\n   ./logs/app.log                 6\n   ./servers.txt                  6\n   total: 54 lines\n3. mapfile into an array (Bash 4.4+ for -d ''):\n   5 files, the third is [files/monthly report.txt]"
    }
  ]
}
```

The pieces of the second method:

- `-print0` makes `find` end each name with a null byte, and `sort -z` sorts null-separated input, so the order is stable.
- `read -d ''` reads up to the next null byte, `-r` keeps backslashes, and `IFS=` keeps leading and trailing spaces.
- `< <(...)` is **process substitution**: the loop reads `find`'s output as if it were a file. Writing `find ... | while read` would also work, but the loop would run in a subshell and `total` would be 0 afterwards ([Part 5](/guides/introduction-to-bash/05-control-structures) shows why).

`find -exec ... {} +` is the simplest choice when one command can take all the names. Use the loop when you need Bash logic for each file. [Count lines of code recursively](/posts/count-lines-of-code-recursively) has more variations.

## Test Files and Directories

`[[ ... ]]` has a test for every question you can ask about a path:

| Test             | True when                                                   |
| ---------------- | ----------------------------------------------------------- |
| `-e path`        | The path exists (any type)                                  |
| `-f path`        | It is a regular file (after following symlinks)             |
| `-d path`        | It is a directory (after following symlinks)                |
| `-L path`        | It is a symbolic link (even a broken one)                   |
| `-s path`        | It exists and is not empty                                  |
| `-r`, `-w`, `-x` | You can read, write or execute it                           |
| `a -nt b`        | `a` was modified more recently than `b` (or `b` is missing) |
| `a -ot b`        | `a` is older than `b`                                       |
| `a -ef b`        | Both names refer to the same file                           |

```terminal
{
  "title": "file tests",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "[[ -d logs ]] && echo \"logs is a directory\"",
      "output": "logs is a directory"
    },
    {
      "cmd": "[[ ! -e logs/error.log ]] && echo \"logs/error.log does not exist\"",
      "output": "logs/error.log does not exist"
    },
    {
      "cmd": "[[ -s logs/app.log ]] && echo \"app.log is not empty\"",
      "output": "app.log is not empty"
    },
    {
      "cmd": "ln -s logs/gone.log broken && [[ -L broken && ! -e broken ]] && echo \"broken is a dangling symlink\"; rm broken",
      "output": "broken is a dangling symlink"
    },
    {
      "cmd": "touch -d '2026-01-01' servers.txt; if [[ logs/app.log -nt servers.txt ]]; then echo \"app.log is newer than servers.txt\"; fi",
      "output": "app.log is newer than servers.txt"
    }
  ]
}
```

Checking whether a directory is **empty** has no single test. Use a glob with `nullglob` and `dotglob`, so hidden files count too:

```bash
#!/usr/bin/env bash
# is-empty.sh: tell whether each directory given as an argument is empty
shopt -s nullglob dotglob

for dir in "$@"; do
    if [[ ! -d "$dir" ]]; then
        echo "$dir: not a directory"
        continue
    fi
    if [[ ! -r "$dir" || ! -x "$dir" ]]; then # an unlistable directory would look empty
        echo "$dir: permission denied"
        continue
    fi
    entries=("$dir"/*)
    if (( ${#entries[@]} == 0 )); then
        echo "$dir: empty"
    else
        echo "$dir: ${#entries[@]} entries"
    fi
done
```

```terminal
{
  "title": "check if a directory is empty",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mkdir -p empty && bash is-empty.sh empty files logs servers.txt",
      "output": "empty: empty\nfiles: 5 entries\nlogs: 2 entries\nservers.txt: not a directory"
    },
    {
      "cmd": "rmdir empty"
    }
  ]
}
```

Related posts: [check if a file does not exist](/posts/check-file-not-exist-bash) and [get a file name's extension](/posts/extract-filename-extension-bash).

## Read Files

The standard loop for reading a file line by line is `while IFS= read -r line`. Both parts of it matter:

```terminal
{
  "title": "why IFS= and -r",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf '  indented line\\nC:\\\\temp\\\\new\\n' > tricky.txt; cat tricky.txt",
      "output": "  indented line\nC:\\temp\\new"
    },
    {
      "cmd": "while read line; do echo \"[$line]\"; done < tricky.txt",
      "output": "[indented line]\n[C:tempnew]"
    },
    {
      "cmd": "while IFS= read -r line; do echo \"[$line]\"; done < tricky.txt",
      "output": "[  indented line]\n[C:\\temp\\new]"
    },
    {
      "comment": "a last line without a newline is lost...",
      "cmd": "printf 'web-1\\nweb-2' > hosts.txt; while IFS= read -r h; do echo \"host: $h\"; done < hosts.txt",
      "output": "host: web-1"
    },
    {
      "comment": "...unless the loop also accepts a partial line",
      "cmd": "while IFS= read -r h || [[ -n \"$h\" ]]; do echo \"host: $h\"; done < hosts.txt",
      "output": "host: web-1\nhost: web-2"
    },
    {
      "cmd": "rm tricky.txt hosts.txt"
    }
  ]
}
```

Without `IFS=`, `read` strips leading and trailing whitespace. Without `-r`, it treats backslashes as escape characters and removes them. The `|| [[ -n "$h" ]]` handles files whose last line has no newline, which many editors and Windows tools produce.

With a different `IFS`, `read` splits each line into fields. This reads the CSV inventory, skipping the header:

```terminal
{
  "title": "read fields from a CSV file",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "cat inventory.csv",
      "output": "name,role,port\nweb-1,web,80\nweb-2,web,80\ndb-1,db,5432\ncache-1,cache,6379"
    },
    {
      "cmd": "{ read -r header; while IFS=, read -r name role port; do printf '%-8s %-6s %5s\\n' \"$name\" \"$role\" \"$port\"; done; } < inventory.csv",
      "output": "web-1    web       80\nweb-2    web       80\ndb-1     db      5432\ncache-1  cache   6379"
    }
  ]
}
```

The braces share one redirection, so the first `read` takes the header and the loop gets the rest. This works for simple CSV files only; quoted fields with commas inside need a real parser (`python3 -c 'import csv'`, `mlr` or `csvkit`).

Two more ways to read a file:

```terminal
{
  "title": "mapfile and $(< file)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "mapfile -t servers < <(grep -v -e '^#' -e '^$' servers.txt); echo \"${#servers[@]} servers: ${servers[*]}\"",
      "output": "3 servers: web-1.example.com web-2.example.com db-1.example.com"
    },
    {
      "comment": "$(< file) reads a whole file without starting cat",
      "cmd": "config=$(< config/app.env); echo \"${#config} characters\"",
      "output": "78 characters"
    }
  ]
}
```

`mapfile -t` (also called `readarray`) reads lines into an array and `-t` strips the newlines. `$(< file)` is a faster `$(cat file)`; like every command substitution, it removes trailing newlines.

### Reading Configuration Files

A file of `KEY=value` lines can be loaded with `source`, but `source` **runs** the file as Bash code. Anyone who can write to the file can make your script run any command. For files you do not fully control, parse them instead:

```bash
#!/usr/bin/env bash
# read-config.sh: load KEY=value lines without executing the file
declare -A config=()

while IFS='=' read -r key value || [[ -n "$key" ]]; do
    [[ -z "$key" || "$key" == \#* ]] && continue      # skip blank lines and comments
    if [[ ! "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
        echo "skipping invalid key: $key" >&2
        continue
    fi
    value="${value%\"}"; value="${value#\"}"             # remove surrounding double quotes
    config[$key]="$value"
done < "${1:-config/app.env}"

for key in APP_NAME APP_PORT LOG_LEVEL; do
    printf '%-10s = %s\n' "$key" "${config[$key]-<not set>}"
done
```

```terminal
{
  "title": "parse instead of source",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash read-config.sh",
      "output": "APP_NAME   = notes api\nAPP_PORT   = 8080\nLOG_LEVEL  = info"
    },
    {
      "cmd": "printf 'APP_PORT=9090\\n$(touch /tmp/owned)=1\\n' > config/override.env; bash read-config.sh config/override.env",
      "output": "skipping invalid key: $(touch /tmp/owned)\nAPP_NAME   = <not set>\nAPP_PORT   = 9090\nLOG_LEVEL  = <not set>"
    }
  ]
}
```

The second file tried to sneak a command into a key. Parsed, it is just a rejected line; sourced, it would have run. [Part 4](/guides/introduction-to-bash/04-bash-variables) explains the associative array and the `${value#\"}` expansions.

## Write Files

[Part 2](/guides/introduction-to-bash/02-bash-basics) covered `>` and `>>`. Three more techniques come up constantly:

**A here document** writes a block of text, with variables expanded unless you quote the delimiter:

```terminal
{
  "title": "create a file from a here document",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "app=\"notes-api\"; port=8080"
    },
    {
      "cmd": "cat > config/notes-api.service <<EOF\n[Unit]\nDescription=${app} on port ${port}\n\n[Service]\nExecStart=/usr/local/bin/${app} --port ${port}\nEOF"
    },
    {
      "cmd": "cat config/notes-api.service",
      "output": "[Unit]\nDescription=notes-api on port 8080\n\n[Service]\nExecStart=/usr/local/bin/notes-api --port 8080"
    },
    {
      "comment": "a quoted delimiter keeps $ and ` literal",
      "cmd": "cat <<'EOF'\ncost: $5, user: $USER\nEOF",
      "output": "cost: $5, user: $USER"
    }
  ]
}
```

**`tee`** writes to a file and to standard output at the same time; `tee -a` appends. It is also how you write to a root-owned file: `sudo echo "x" > /etc/app.conf` fails, because the redirection is done by your own shell before `sudo` starts, so use `echo "x" | sudo tee /etc/app.conf > /dev/null`.

**Atomic replacement** stops readers from ever seeing a half-written file. Write to a temporary file in the same directory, then rename it; `mv` within one file system replaces the target in a single step:

```bash
tmp=$(mktemp "config/.notes-api.XXXXXX") || exit 1
if generate_config > "$tmp"; then # any command that writes the new content
    chmod 644 "$tmp"               # mktemp creates files with mode 600
    mv -f -- "$tmp" config/notes-api.conf
else
    rm -f -- "$tmp"
    echo "generate_config failed; config/notes-api.conf is unchanged" >&2
    exit 1
fi
```

The `if` matters: if the generator fails halfway, the old file stays in place instead of being replaced by a broken one.

## Temporary Files and Cleanup

Create temporary files with `mktemp`, never with fixed names such as `/tmp/myscript.tmp` or `/tmp/out.$$`. Predictable names let two runs overwrite each other and let other users on the machine plant a symlink in advance. `mktemp` creates a file with a random name and permissions `600` (`mktemp -d` creates a directory with `700`):

```bash
#!/usr/bin/env bash
# tmpdemo.sh: a work directory that is removed however the script ends
workdir=$(mktemp -d "${TMPDIR:-/tmp}/tmpdemo.XXXXXX") || exit 1
trap 'rm -rf -- "$workdir"' EXIT

echo "working in $workdir"
grep ' 404 ' logs/access.log > "$workdir/404.txt"
echo "404 responses: $(wc -l < "$workdir/404.txt")"
stat -c '%A' "$workdir"            # the permissions: only you can enter it
exit 3                                  # even an error exit runs the trap
```

```terminal
{
  "title": "mktemp and trap",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "bash tmpdemo.sh; echo \"exit code: $?\"",
      "output": "working in /tmp/tmpdemo.ZYTyBP\n404 responses: 8\ndrwx------\nexit code: 3"
    },
    {
      "cmd": "ls -d /tmp/tmpdemo.* 2>&1",
      "output": "ls: cannot access '/tmp/tmpdemo.*': No such file or directory"
    }
  ]
}
```

`trap '...' EXIT` runs its command whenever the script exits, whether it reaches the end, calls `exit` or stops on an error. [Part 10](/guides/introduction-to-bash/10-bash-best-practices) covers traps for signals and errors too.

## Windows Line Endings

A file saved on Windows ends each line with a carriage return and a newline (CRLF). Bash treats the carriage return as part of the text, so comparisons fail for no visible reason, and a script with CRLF endings does not even start ([Part 7](/guides/introduction-to-bash/07-script-permissions) shows the errors):

```terminal
{
  "title": "an invisible \\r breaks a comparison",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "printf 'LOG_LEVEL=debug\\r\\n' > win.env; file win.env",
      "output": "win.env: ASCII text, with CRLF line terminators"
    },
    {
      "cmd": "IFS='=' read -r key value < win.env; if [[ \"$value\" == debug ]]; then echo \"debug mode\"; else echo \"not debug: ${value@Q}\"; fi",
      "output": "not debug: $'debug\\r'"
    },
    {
      "cmd": "sed -i 's/\\r$//' win.env; file win.env",
      "output": "win.env: ASCII text"
    },
    {
      "cmd": "rm win.env"
    }
  ]
}
```

`${value@Q}` prints the value quoted so hidden characters show; here it revealed the `\r`. `sed -i 's/\r$//'` or `dos2unix` fixes the file, and `value=${value%$'\r'}` fixes one variable.

## Common Mistakes

- **Looping over `$(ls)` or `$(find ...)`.** Names with spaces split. Use globs, or `find -print0` with `read -d ''`.
- **Forgetting that an unmatched glob stays literal.** Use `shopt -s nullglob` or test `[[ -e "$f" ]]` in the loop.
- **Passing glob results without `--` or `./`.** A file called `-rf` becomes an option.
- **`while read line` without `IFS=` and `-r`.** Leading spaces and backslashes disappear.
- **Sourcing a config file someone else can edit.** `source` runs code; parse untrusted files.
- **Fixed temporary file names.** Use `mktemp` and a `trap ... EXIT`.
- **`sudo echo ... > /root-owned/file`.** The redirection runs as you; use `sudo tee`.

## Summary

- Globs expand to sorted file names, skip hidden files, and stay literal when nothing matches; `nullglob`, `failglob`, `dotglob`, `globstar` and `extglob` change that.
- Braces generate names whether files exist or not.
- Protect file names with quotes and `--` or `./`, and never parse `ls`.
- For trees, use `find -exec ... {} +` or a `while IFS= read -r -d ''` loop over `find -print0`.
- Read lines with `while IFS= read -r line`, fields with `IFS=,`, and whole files with `mapfile` or `$(< file)`.
- Use `mktemp` for temporary files, `trap ... EXIT` for cleanup and a rename for atomic writes.

Next: [Bash Variables](/guides/introduction-to-bash/04-bash-variables), with parameter expansion, arithmetic and arrays.

## Keep Learning

- [Loop through the lines of a file](/posts/bash-loop-through-file-content)
- [Check if a file does not exist](/posts/check-file-not-exist-bash)
- [List directories with their sizes](/posts/using-ls-list-directories-sizes)
- [How cat <<EOF works](/posts/how-cat-eof-works-in-bash)
- Interview questions: [Linux file permissions](/interview-questions/junior/linux-file-permissions)
