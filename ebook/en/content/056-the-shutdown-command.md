# The  `shutdown` command
---
The shutdown command may be used to halt, power-off or reboot the machine.
 The first argument may be a time string (which is usually "now"). Optionally, this may be followed by a wall message to be sent to all     logged-in users before going down.


The time string may either be in the format "hh:mm" for hour/minutes specifying the time to execute the shutdown at, specified in 24h
       clock format. Alternatively it may be in the syntax "+m" referring to the specified number of minutes m from now.  "now" is an alias
       for "+0", i.e. for triggering an immediate shutdown. If no time argument is specified, "+1" is implied.


Note that to specify a wall message you must specify a time argument, too.

If the time argument is used, 5 minutes before the system goes down the /run/nologin file is created to ensure that further logins
       shall not be allowed.

Examples :
1.   To simply poweroff the machine immediately we need not pass any argument.

```
shutdown 
```

2.  To reboot the machine you may pass the `-r` or `--reboot` argument as follow

```
shutdown -r
```

3.  To shutdown the machine at a specific time, say 1:00 PM, you may pass time as follows: 

```
shutdown 13:00
```

4. A more generalized command: 

```
shutdown [OPTIONS]
```
The following options are understood : 
---
1.   --help 
 > Used to display the help and exit
2.   -H, --halt
 > Halt the machine
3.    -P, --poweroff
> Power-off the machine (the default).
4. -r, --reboot
 > Reboot the machine.
5.-h
> Equivalent to --poweroff, unless --halt is specified.
6.-k
> Do not halt, power-off, reboot, just write wall message.
7. --no-wall
>Do not send wall message before halt, power-off, reboot.
8. -c
 >Cancel a pending shutdown. This may be used to cancel the effect of an invocation of shutdown with a time argument that is not "+0" or "now".

---
##EXIT STATUS
On success, 0 is returned, a non-zero failure code otherwise.



