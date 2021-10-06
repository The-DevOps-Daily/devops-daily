# The `mpstat` Command
---

  The mpstat command writes to standard output activities for each available processor, processor 0 being the first one.  Global average activities among all processors are also reported. The  `mpstat` command can be used on both SMP and UP machines, but in the latter, only global average activities will be printed. If no activity has been selected, then the default report is the CPU utilization report.
  
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
|---|---|---|
| -A | - |This option is equivalent to specifying -n -u -I ALL. This option also implies specifying -N ALL -P ALL unless these options are explicitly set on the command  line.|
| - | --dec={ 0 or 1 or 2 } | Specify the number of decimal places to use (0 to 2, default value is 2).|
| `-I { keyword[,...] or ALL }`| - |  Report interrupts statistics.  Possible keywords are CPU, SCPU, and SUM. With the CPU keyword, the number of each individual interrupt     received per second by the CPU or CPUs is displayed. Interrupts are those listed in /proc/interruptsfile. With the SCPU keyword, the number of each individual software interrupt received per second by the CPU or CPUs is displayed. This option works only with kernels 2.6.31 and later. Software interrupts are those listed in `/proc/softirqs` file. With the SUM keyword, the mpstat command reports the total number of interrupts per processor.  The following values are displayed: *CPU*    Processor number. The keyword all indicates that statistics are calculated as averages among all processors. *intr/s* Show the total number of interrupts received per second by the CPU or CPUs. The ALL keyword is equivalent to specifying all the keywords above and therefore all the interrupts statistics are displayed. |
| -N { node_list | ALL } | - |  Indicate the NUMA nodes for which statistics are to be reported.  node_list is a list of comma-separated values or range of values (e.g., 0,2,4-7,12-). Note that node all is the global average among all nodes. The ALL keyword indicates that statistics are to be reported for all nodes. |
| -n  | - |Report summary CPU statistics based on NUMA node placement. The following values are displayed: *NODE*   Logical NUMA node number. The keyword all indicates that statistics are calculated as averages among all nodes. All the other fields are the same as those displayed with option -u (see below).| 
|  -o JSON |  - | Display the statistics in JSON (Javascript Object Notation) format.  JSON output field order is undefined, and new fields may be added in the future.| 
| -P { cpu_list or ALL } |  - | Indicate the processors for which statistics are to be reported.  cpu_list is a list of comma-separated values or range of values (e.g., 0,2,4-7,12-).  Note that processor 0 is the first processor, and processor all is the global average among all processors.  The ALL keyword indicates that statistics are to be reported for all processors. Offline processors are not displayed.| 
| -T  |  - |  Display topology elements in the CPU report (see option -u below). The following elements are displayed CORE   Logical core number. SOCK   Logical socket number. NODE   Logical NUMA node number. | 
|  -u  |  - | Report CPU utilization. The following values are displayed:- CPU    Processor number. The keyword all indicates that statistics are calculated as averages among all processors. **%usr**   Show the percentage of CPU utilization that occurred while executing at the user level(application).**%nice**  Show the percentage of CPU utilization that occurred while executing at the user level with nice priority. **%sys**   Show the percentage of CPU utilization that occurred while executing at the system level (kernel). Note that this does not include time spent servicing hardware and software interrupts. **%iowait**  Show the percentage of time that the CPU or CPUs were idle during which the system had an outstanding disk I/O request. **%irq**   Show the percentage of time spent by the CPU or CPUs to service hardware interrupts. **%soft**  Show the percentage of time spent by the CPU or CPUs to service software interrupts. **%steal** Show the percentage of time spent in involuntary wait by the virtual CPU or CPUs while the hypervisor was servicing another virtual processor. **%guest** Show the percentage of time spent by the CPU or CPUs to run a virtual processor. **%gnice** Show the percentage of time spent by the CPU or CPUs to run a niced guest. **%idle**  Show the percentage of time that the CPU or CPUs were idle and the system did not have an outstanding disk I/O request. | 
|  -V  | - | Print version number then exit. | 
              

