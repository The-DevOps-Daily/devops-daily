# The `sync` command

The sync command flushes file system buffers, ensuring that data in memory is written to disk. It’s often used before shutdowns or unmounting disks.

Syntax:
sync [OPTIONS] [FILE]

Examples:

To flush all filesystem buffers:
```
sync
```

To flush a specific file to disk:
```
sync myfile.txt
```
### Additional Flags and their Functionalities:
|**Short Flag**   |**Long Flag**   |**Description**   |
|:---|:---|:---|
|`<center>-</center>`|`	--data`|	Flush only data, not metadata.|
|`<center>-</center>`|`	--file-system`|	Sync the entire file system containing FILE.|
