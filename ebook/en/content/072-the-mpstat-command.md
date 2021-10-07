# The `mpstat` Command
---

  The `mpstat` command writes to standard output activities for each available processor, processor 0 being the first one.  Global average activities among all processors are also reported. The  `mpstat` command can be used on both SMP and UP machines, but in the latter, only global average activities will be printed. If no activity has been selected, then the default report is the CPU utilization report.
  
The interval parameter specifies the amount of time in seconds between each report.  A value of 0 (or no parameters at all) indicates that processors statistics are to be reported for the time since system startup (boot). The count parameter can be specified in conjunction with the interval parameter if this one is not set to zero. The value of count determines the number of reports generated at interval seconds apart. If the interval parameter is specified without the count parameter, the `mpstat` command generates reports continuously.


## EXAMPLES 

1. Display five reports of global statistics among all processors at two second intervals.
```
mpstat 2 5
```
2. Display five reports of statistics for all processors at two second intervals.
```
mpstat -P ALL 2 5
```

# Syntax 


```
mpstat [ -A ] [ --dec={ 0 | 1 | 2 } ] [ -n ] [ -u ] [ -T ] [ -V ]
       [ -I { keyword[,...] | ALL } ] [ -N { node_list | ALL } ] 
       [ -o JSON ] [ -P { cpu_list | ALL } ] [ interval [ count ] ]

```


| Short Flag |	Long Flag |	Description |
### Options and their Functionalities:

|Short Flag   |Description   |
|---|---|
| -A | to display all the detailed statistics|
| -h | to display mpstat help|
| -I | to display detailed interrupts statistics|
| -n | to report summary CPU statistics based on NUMA node placement|
| -N | to indicate the NUMA nodes for which statistics are to be reported|
| -P | to indicate the processors for which statistics are to be reported|
| -o | to display the statistics in JSON (Javascript Object Notation) format|
| -T | to display topology elements in the CPU report|
| -u | to report CPU utilization|
| -v | to display utilization statistics at the virtual processor level|
| -V | to display mpstat version|
| -ALL |to display detailed statistics about all CPUs|
