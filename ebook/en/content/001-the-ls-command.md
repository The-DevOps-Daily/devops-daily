# The `ls` command

The `ls`, or "list" command, lets you see the files and directories inside a specific directory *(current working directory by default)*.
It normally lists the files and directories in ascending alphabetical order.

### Examples:

1. To show the files inside your current working directory:

```
ls
```

2. To show the files and directory inside a specific directory:

```
ls {Directory_Path}
```

### Syntax:

```
ls [-OPTION] [DIRECTORY_PATH]
```

### Interactive training

In this interactive tutorial, you will learn the different ways to use the `ls` command:

[The 'ls' command by Tony](https://devdojo.com/tnylea/ls-command)

### Additional Flags and their Functionalities:

|**Short Flag**   |**Long Flag**   |**Description**   |
|:---|:---|:---|
|`-l`|<center>-</center>|Show results in long format|
|`-S`|<center>-</center>|Sort results by file size|
|`-t`|<center>-</center>|Sort results by modification time|
|`-r`|`--reverse`|Show files and directories in reverse order *(descending alphabetical order)*|
|`-a`|`--all`|Show all files, including hidden files *(file names which begin with period `.`)*|
|`-A`|`--almost-all`|Shows all like `-a` but without showing `.`(Current Working Directory) and `..` (Parent Directory)|
|`-d`|`--directory`|Instead of listing the files and directories inside the directory, it shows information about the directory itself, and can be used with `-l` to show long formatted information|
|`-F`|`--classify`|Appends an indicator character to the end of each listed name, as an example: a forward slash `/` is appended after each directory listed|
|`-h`|`--human-readable`|like `-l` but displays the file size in a human-readable unit rather than bytes|
