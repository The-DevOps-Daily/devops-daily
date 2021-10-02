# The `cd` command

The `cd` command lets you see the files and directories inside a Specific directory *(current working directoy by default)*.
It Normally Lists the files and directories in ascending alphabetical order.


The `cd` command stands for `chdir` (**Ch**ange **Dir**ectory), Often combined with the `ls` command that shows files and folders, `cd` allows you to navigate through folders/directorys, Much like navigating through chapters and pages in a book.


### Examples:

1. To naviagate into a folder:

```
cd folder_name
```

2. To navigate through multiple folders:

```
cd {Directory_Path}
cd /home/user/101-linux-commands-ebook/ebook/en/content/
```

### Syntax:

```
ls [-OPTION] [DIRECTORY_PATH]
```

### Quick Tips

Adding a `..` as a directory will allow you to move "up" from a folder, this can be done multiple times too!
eg. `cd ..` to move up one folder or `cd ../../../` to move up 3!


### Additional Flags and their Functionalities:

|**Short Flag**   |**Description**   |
|:---|:---|
|`-L`|force symbolic links to be followed: resolve symbolic links in DIR after processing instances of `..'|
|`-P`|use the physical directory structure without following symbolic links: resolve symbolic links in DIR before processing instances of `..'|
|`-e`|if the -P option is supplied, and the current working directory cannot be determined successfully, exit with a non-zero status|
|`-@`|`--reverse`|Show files and directories in reverse order *(descending Alphabetical order)*|002-the-cd-command.md
