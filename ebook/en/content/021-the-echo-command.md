# The `echo` command

The `shutdown` command is used to display text that is passed as an argument.
It is a built in commannd that is mostly used in scripts to output status text.

### Examples:

1. Normal text output:

```
echo "I am a echo"
```
Output: I am a echo

2. Text output with esacpe characters enabled:

```
echo -e "I \bam \ba echo"
```
Output: Iama echo

3. Print all folders/files:

```
echo *
```

### Syntax:

```
echo [OPTIONS] [STRING]
```

### Available esacpe characters:

|**Esacpe character** |**Description**   |
|:---|:---|
|`\\`|Displays a backslash character|
|`\a`|Plays a sound alert|
|`\b`|Creates a backspace character|
|`\c`|Omits any output following it|
|`\e`|Equivalent to pressing Esc|
|`\f`|Form feed character|
|`\n`|Adds a new line to the output|
|`\t`|Creates a horizontal tab space|
|`\t`|Creates a vertical tab space|
|`\NNN`|Byte with the octal value of NNN|
|`\xHH`|Byte with the hexadecimal value of NNN|

### Additional Flags and their Functionalities:

|**Short Flag**   |**Long Flag**   |**Description**   |
|:---|:---|:---|
|`-e`|<center>-</center>|Enables esacpe character|
|`-n`|<center>-</center>|Omitting the newline after the text|
|`-E`|<center>-</center>|Disables esacpe character|
