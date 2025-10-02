# The `watch` command

The watch command runs a program repeatedly, displaying its output and errors in full screen. By default, it runs the given command every 2 seconds and updates the display.

### Syntax:
watch [OPTIONS] command

### Examples:

To run a command every 2 seconds (default):
```
watch date
```

To run a command every 5 seconds:
```
watch -n 5 ls
```

To highlight differences between updates:
```
watch -d df -h
```

### Additional Flags and their Functionalities:
|**Short Flag**   |**Long Flag**   |**Description**   |
|:---|:---|:---|
|`-n`| `seconds	--interval=sec `|	Sets the interval between updates (default is 2 seconds). |
|`-d`|`--differences`	|Highlight the changes between updates. |
|`-t`|`--no-title`|	Turn off the header showing interval, time, and command.|
|`-g`|`	--chgexit`|	Exit when output changes.|
|`-b`|`	--beep`|	Beep if command has a non-zero exit. | 
