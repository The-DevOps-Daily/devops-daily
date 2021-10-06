# The `ip` command

`ip` command in Linux is present in the net-tools which is used for performing several network administration tasks. IP stands for Internet Protocol. This command is used to show or manipulate routing, devices, and tunnels. It is similar to [ifconfig] (<https://github.com/bobbyiliev/101-linux-commands-ebook/blob/main/ebook/en/content/041-the-ifconfig-command.md>)command but it is much more powerful with more functions and facilities attached to it.

### Examples

1. To assign an IP Address to a specific interface (eth1) :

```
 ip addr add 192.168.50.5 dev eth1
```

2. To show detailed information about network interfaces like IP Address, MAC Address information etc. :

```
ip addr show
```


### Syntax:

```
ip [ OPTIONS ] OBJECT { COMMAND | help }
```

### Additional Flags and their Functionalities

|**Short Flag**   |**Long Flag**   |**Description**   |
|:---|:---|:---|
|`-a`|`--address`|IPv4 or IPv6 address on a device|
|`-l`|`--link`|Network devise in network|
|`-addrl`|`--addrlabel`|Label configuration for protocol address selection|
|`-n`|`--neighbour`|ARP or NDISC cache entry|
|`-r`|`--route`|Routing table entry|
|`-m`|`--maddress`|Multicast address|
|`-ru`|`--rule`|Rule in routing policy database|
|`-mr`|`--mroute`|Multicast routing cache|
