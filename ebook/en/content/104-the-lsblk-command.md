# The ``lsblk`` command

## Summary
The ``lsblk`` command displays the block and loop devices on the system. Is is especially useful when you want to format disks, write filesystems, check the filesystem and know the mount point of a device.

## Syntax
```
lsblk [options] [<device> ...]
```

## Reading information given by ``lsblk``
On running ``lsblk`` with no flags or command-line arguments, it writes general disk information to the STDOUT.
Here is a table that interpret that information:

| Column Name | Meaning                           | Interpretation                                              |
|:-----------:|:----------------------------------|:------------------------------------------------------------|
| NAME        | Name of the device.               | Shows name of the device.                                   |
| RM          | Removable.                        | Shows 1 if the device is removable, 0 if not.               |
| SIZE        | Size of the device.               | Shows size of the device.                                   |
| RO          | Read-Only.                        | Shows 1 if read-only, 0 if not.                             |
| TYPE        | The type of block or loop device. | Shows ``disk`` for entire disk and ``part`` for partitions. |
| MOUNTPOINTS | Where the device is mounted.      | Shows where the device is mounted. Empty is not mounted.    |

## Reading information of a specific device
``lsblk`` can display information of a specific device when the device's absolute path is passed to it.
For example: ``lsblk`` command for displaying the information of the ``sda`` disk.
```
lsblk /dev/sda
```

## Useful flags for ``lsblk``
Here is a table that show some of the useful flags that can be used with lsblk

| Flag                      | Interpretation                               |
|:-------------------------:|:---------------------------------------------|
| ``-f`` / ``fs``           | Displays information about filesystem.       |
| ``-J`` / ``--json``       | Displays all the information in JSON Format. |
| ``-l`` / ``--list``       | Displays all the information in List Format. |
| ``-T`` / ``--tree``       | Displays all the information in Tree Format. |
| ``-m`` / ``--perms``      | Displays device permissions.                 |
| ``-p`` / ``--paths``      | Displays absolute device paths.              |
| ``-o`` / ``--output-all`` | Displays all available columns.              |
| ``-s`` / ``--scsi``       | Displays SCSI devices only                   |

## Exit Codes
Like every UNIX / Linux Program, ``lslbk`` returns an exit code to the environment.
Here is a table of all the exit codes.

| Exit Code | Meaning                                                    |
|:---------:|:-----------------------------------------------------------|
| 0         | Exit with success.                                         |
| 1         | Exit with failure.                                         |
| 32        | Specified device(s) not found.                             |
| 64        | Some of the specified devices were found while some not.   |
