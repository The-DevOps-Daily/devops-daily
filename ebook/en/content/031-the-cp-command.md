
# The `cp` command

The `cp` command lets you copy files and directories from one place to another.

## Usage Cases and Examples:

1. ### Two file names : 
If the command contains two file names, then it copy the contents of **1st file** to the **2nd file**. If the 2nd file doesn’t exist, then first it creates one and content is copied to it. But if it existed then it is simply overwritten without any warning. So be careful when you choose destination file name.
```
cp src_file dst_file
```

2. ### One or more arguments :
If the command has one or more arguments, specifying file names and following those arguments, an argument specifying directory name then this command copies each source file to the destination directory with the same name, created if not existed but if already existed then it will be overwritten, so be careful !!.
```
cp Src_file1 Src_file2 Src_file3 Dest_directory
```
#### Note: 
For this case last argument _must_ be a **directory** name. For the above command to work, _Dest_directory_ must exist because **cp** command won’t create it.

3. ### Two directory names :
f the command contains two directory names, **cp** copies all files of the source directory to the destination directory, creating any files or directories needed. This mode of operation requires an additional option, typically **R**, to indicate the recursive copying of directories.

```
cp -R Src_directory Dest_directory
```
#### Note:
In the above command, **cp** behavior depend upon whether _Dest_directory_ is exist or not. If the _Dest_directory_ doesn’t exist, cp creates it and copies content of _Src_directory_ recursively as it is. But if Dest_directory exists then copy of _Src_directory_ becomes sub-directory under _Dest_directory_.

## Syntax:

```
cp [OPTION] SOURCE DESTINATION
cp [OPTION] SOURCE DIRECTORY
cp [OPTION] SOURCE-1 SOURCE-2 SOURCE-3 SOURCE-n DIRECTORY
```
First and second syntax is used to copy Source file to Destination file or Directory.
Third syntax is used to copy multiple Sources(files) to Directory.

### Additional Flags and their Functionalities:

|**Short Flag**   |**Long Flag**   |**Description**   |
|:---|:---|:---|
|`-i`|<center>--interactive</center>|prompt before overwrite|
|`-f`|<center>--force</center>|If an existing destination file cannot be opened, remove it and try again|
|`-b`|<center>-</center>|Creates the backup of the destination file in the same folder with the different name and in different format.|
|`-r or -R`|`--recursive`|**cp** command shows its recursive behavior by copying the entire directory structure recursively.|
|`-n`|`--no-clobber`|do not overwrite an existing file (overrides a previous -i option)|
|`-p`|<center>-</center>|preserve the specified attributes (default: mode,ownership,timestamps), if possible additional attributes: context, links, xattr, all|

