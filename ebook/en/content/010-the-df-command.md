# The `df` command

The `df` command is an abbreviation for "disk free" and lets you check how much disk space
is available across your devices, drives or disk.
By default it gives detailed information, however mostly it is used with the option "-h" which
shows the available in more human readable sizes (i.e. gigabytes).
### Examples:

1. To show all mounted drives with the size, usage, available space and percentage of capacity used (sizes are in bytes)

```
df
```

2. To show all mounted drives with the size, usage, available space and percentage of capacity used (sizes are converted into human readable sizes)

```
df -h
```

3. Show

### Syntax:

```
df [-OPTION] [FILE]
```

### Additional Flags and their Functionalities:

Additional options are OS dependant.

|**Short Flag**   |**Description**   |
|---|---|
|`-h`|human readable sizes to power of 1024 (base of 2 for sizes)|
|`-H`|human readable sizes to power of 1000 (base of 10 for sizes)|
|`-i`|show inode information instead of block usage|
|`-l`|limit output to local file systems|
|`-l`|limit output to local file systems|