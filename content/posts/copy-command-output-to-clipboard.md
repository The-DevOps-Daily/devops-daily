---
title: 'How to Copy Command Output Directly to Your Clipboard in Linux'
excerpt: 'Pipe command output to the clipboard with wl-copy on Wayland, xclip or xsel on X11, pbcopy on macOS and clip.exe on WSL. Paste it back, write clipboard functions for scripts, and copy to your local clipboard over SSH.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2024-09-25'
publishedAt: '2024-09-25T09:00:00Z'
updatedAt: '2026-11-13T09:00:00Z'
readingTime: '9 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
tags:
  - Linux
  - Command Line
  - Clipboard
  - Wayland
  - xclip
  - Bash
---

You run a command that outputs a long string, maybe a hash, a file path, a token or a public key, and you need to paste it somewhere else. Instead of selecting it with the mouse, you can pipe it straight to the clipboard. The right command depends on the display system: Wayland and X11 on Linux use different tools, and macOS, WSL and SSH sessions each have their own.

## TLDR

| Environment          | Copy                                                   | Paste                                              |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Linux, Wayland       | `cmd \| wl-copy`                                       | `wl-paste`                                         |
| Linux, X11           | `cmd \| xclip -selection clipboard`                    | `xclip -selection clipboard -o`                    |
| Linux, X11 with xsel | `cmd \| xsel --clipboard`                              | `xsel --clipboard --output`                        |
| macOS                | `cmd \| pbcopy`                                        | `pbpaste`                                          |
| WSL                  | `cmd \| clip.exe`                                      | `powershell.exe -NoProfile -Command Get-Clipboard` |
| Over SSH             | `ssh host 'cmd' \| wl-copy` on your machine, or OSC 52 | n/a                                                |

## Prerequisites

- A desktop session on Linux, macOS or Windows with WSL. A server without a graphical session has no clipboard.
- The clipboard tool for your system. Install commands are below.

## How Do I Copy Command Output to the Clipboard in Linux?

First check which display system your session uses:

```bash
echo "$XDG_SESSION_TYPE"     # wayland or x11
```

Current GNOME and KDE Plasma sessions on Ubuntu, Fedora and Debian use Wayland by default. Install the tool for your session:

```bash
# Wayland
sudo apt install wl-clipboard      # Debian, Ubuntu
sudo dnf install wl-clipboard      # Fedora, RHEL
sudo pacman -S wl-clipboard        # Arch

# X11
sudo apt install xclip             # or xsel
sudo dnf install xclip
sudo pacman -S xclip
```

Then pipe the output to it:

```bash
# Wayland
cat ~/.ssh/id_ed25519.pub | wl-copy
git rev-parse HEAD | wl-copy

# X11
cat ~/.ssh/id_ed25519.pub | xclip -selection clipboard
pwd | xsel --clipboard
```

You can also redirect a file instead of using `cat`: `wl-copy < config.json` or `xclip -selection clipboard < config.json`.

xclip and X11 apps can work in a Wayland session through XWayland, but native Wayland apps do not always see what they copy. Use `wl-copy` on Wayland. Both `wl-copy` and `xclip` return at once and stay in the background, because on Linux the program that copied the data serves it to the program that pastes it.

### Remove the Trailing Newline

Most commands end their output with a newline, and the clipboard keeps it. When you paste into a terminal, the newline can run the command at once. Strip it:

```bash
git rev-parse HEAD | wl-copy -n                      # -n: trim the trailing newline
git rev-parse HEAD | xclip -selection clipboard -rmlastnl
printf '%s' "$(git rev-parse HEAD)" | pbcopy         # works with any tool
```

### Clipboard or Primary Selection?

X11 and Wayland have two selections:

- The **clipboard** is what Ctrl+C and Ctrl+V use.
- The **primary selection** is the text you last highlighted, pasted with the middle mouse button.

`xclip` without options writes the primary selection, which is why `xclip -selection clipboard` (short form `xclip -sel clip`) appears in every example. `xsel` also defaults to the primary selection, and `--clipboard` (`-b`) selects the clipboard. `wl-copy` uses the clipboard by default, and `wl-copy --primary` writes the primary selection.

### Paste From the Clipboard in the Terminal

```bash
wl-paste -n > notes.txt                        # Wayland, without an extra newline
xclip -selection clipboard -o > notes.txt      # X11
xsel --clipboard --output                      # X11 with xsel
pbpaste | jq .                                 # macOS: format JSON from the clipboard
```

### Make a Short Command

An alias is enough here, because the input comes from the pipe and there are no arguments to place:

```bash
# in ~/.bashrc
alias clip='xclip -selection clipboard'     # or: alias clip='wl-copy'
alias clipo='xclip -selection clipboard -o'

pwd | clip
```

For anything that needs arguments, use a function instead of an alias ([why aliases cannot take parameters](/posts/permanently-set-path-on-linux-unix#h2-how-do-i-create-a-bash-alias-that-takes-parameters)).

## How Do I Pipe to and From the Clipboard in a Bash Script?

A script should not assume one tool. Pick the one that works in the current session, and fail with a clear message when there is none:

```bash
clip_copy() {
    if [[ -n ${WAYLAND_DISPLAY-} ]] && command -v wl-copy >/dev/null 2>&1; then
        wl-copy
    elif [[ -n ${DISPLAY-} ]] && command -v xclip >/dev/null 2>&1; then
        xclip -selection clipboard
    elif [[ -n ${DISPLAY-} ]] && command -v xsel >/dev/null 2>&1; then
        xsel --clipboard --input
    elif command -v pbcopy >/dev/null 2>&1; then
        pbcopy
    elif command -v clip.exe >/dev/null 2>&1; then
        clip.exe
    else
        echo "clip_copy: no clipboard tool found" >&2
        return 1
    fi
}

clip_paste() {
    if [[ -n ${WAYLAND_DISPLAY-} ]] && command -v wl-paste >/dev/null 2>&1; then
        wl-paste -n
    elif [[ -n ${DISPLAY-} ]] && command -v xclip >/dev/null 2>&1; then
        xclip -selection clipboard -o
    elif [[ -n ${DISPLAY-} ]] && command -v xsel >/dev/null 2>&1; then
        xsel --clipboard --output
    elif command -v pbpaste >/dev/null 2>&1; then
        pbpaste
    elif command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command Get-Clipboard
    else
        echo "clip_paste: no clipboard tool found" >&2
        return 1
    fi
}
```

The checks for `WAYLAND_DISPLAY` and `DISPLAY` matter: `xclip` can be installed on a server or in an SSH session where no display exists, and it then fails with `Error: Can't open display`.

With the two functions, a script can read the clipboard, change the text and put it back:

```bash
clip_paste | jq . | clip_copy                     # format the JSON in the clipboard
clip_paste | tr -s ' ' | clip_copy                # squeeze repeated spaces
printf '%s' "$(realpath -- "$1")" | clip_copy     # copy the full path of a file, without the newline
```

## How Do I Copy to My Local Clipboard Over SSH?

The clipboard belongs to your desktop, not to the server. The simplest answer is to run the command over SSH and pipe the result on your own machine:

```bash
ssh web-1 'cat /etc/nginx/nginx.conf' | wl-copy
ssh web-1 'journalctl -u app -n 50 --no-pager' | pbcopy
```

When you are already in a shell on the server, use the **OSC 52** escape sequence. The program on the server prints the text, base64 encoded, inside an escape sequence, and your terminal emulator puts it in your local clipboard:

```bash
# on the server
osc52() { printf '\e]52;c;%s\a' "$(base64 | tr -d '\n')"; }

hostname -f | osc52
```

Many current terminal emulators support OSC 52, and some need it turned on in their settings. Inside tmux, add `set -g set-clipboard on` to `~/.tmux.conf` so tmux passes the sequence through. Large texts can hit a size limit of the terminal.

X11 forwarding (`ssh -X` or `ssh -Y`) with `xclip` on the server can also work, because xclip then talks to your local X server. It is slow, it needs an X server or XWayland on your side, and it can give programs on the server access to your X session. Prefer the two methods above.

## How Do I Keep Secrets Out of the Clipboard?

On X11, every program in your session can read the clipboard. Wayland compositors restrict access more, but clipboard managers on both systems can keep a history of what you copied. Do not copy private keys or long-lived tokens unless you have to. When you do:

- Use a password manager that clears the clipboard after a timeout. For example, `pass -c name` clears it after 45 seconds.
- Clear the clipboard yourself when you are done: `wl-copy --clear`, `xsel --clipboard --clear`, or copy an empty string with `printf '' | pbcopy`.
- Do not write generated secrets to a plain text file "for later". Put them in a secret store.

## Related Resources

- [What does 2>&1 mean?](/posts/what-does-2-and-1-mean-linux-bash): include error messages when you pipe output to the clipboard
- [How to permanently set $PATH and write aliases](/posts/permanently-set-path-on-linux-unix): where to keep the `clip` alias
- [How to find the IP address of an SSH client](/posts/find-ssh-client-ip-address)
- [SSH hardening checklist](/checklists/ssh-hardening)
