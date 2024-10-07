
# The `finger` command

The `finger` displays information about the system users.

### Examples:

1. View detail about a particular user.

```
finger abc
```
*Output*
```
Login: abc                          Name: (null)
Directory: /home/abc                Shell: /bin/bash
On since Mon Nov  1 18:45 (IST) on :0 (messages off)
On since Mon Nov  1 18:46 (IST) on pts/0 from :0.0
New mail received Fri May  7 10:33 2013 (IST)
Unread since Sat Jun  7 12:59 2003 (IST)
No Plan.
```

2. View login details and Idle status about an user

```
finger -s root
```
*Output*
```
Login     Name       		Tty      Idle  Login Time   Office     Office Phone
root         root           *1    19d Wed 17:45
root         root           *2     3d Fri 16:53
root         root           *3        Mon 20:20
root         root           *ta    2  Tue 15:43
root         root           *tb    2  Tue 15:44
```
### Syntax:

```
finger [-l] [-m] [-p] [-s] [username]
```


### Additional Flags and their Functionalities:

|**Flag**   |**Description**   |
|:---|:---|
|`-l`|Force long output format.|
|`-m`|Match arguments only on user name (not first or last name).|
|`-p`|Suppress printing of the .plan file in a long format printout.|
|`-s`|Force short output format.|

### Additional Information
**Default Format**

The default format includes the following items:

Login name  
Full username  
Terminal name  
Write status (an * (asterisk) before the terminal name indicates that write permission is denied)  
For each user on the host, the default information list also includes, if known, the following items:

Idle time (Idle time is minutes if it is a single integer, hours and minutes if a : (colon) is present, or days and hours if a “d” is present.)  
Login time  
Site-specific information

**Longer Format**

A longer format is used by the finger command whenever a list of user’s names is given. (Account names as well as first and last names of users are accepted.) This format is multiline, and includes all the information described above along with the following:

User’s $HOME directory  
User’s login shell  
Contents of the .plan file in the user’s $HOME directory  
Contents of the .project file in the user’s $HOME directory

## Privacy Considerations

The `finger` command can expose sensitive information about system users, which may pose privacy risks, especially in shared or multi-user environments. The following details are typically revealed when running the command:

1. **Usernames and Login Times**:
   The `finger` command displays the exact times users have logged in and, in some cases, how long they have been idle. This information can be used to track user activity, which could be exploited by malicious users to monitor when a system is most vulnerable (e.g., during periods of inactivity).

2. **Home Directories**:
   The command shows users' home directory paths (e.g., `/home/abc`). Knowledge of a user's home directory can help unauthorized individuals target specific locations for potential attacks or data theft.

3. **Idle Status**:
   The idle status (how long a user has been inactive) is shown with the command. This can indicate whether a user is currently active or away from their terminal, potentially signaling an opportunity for malicious users to exploit unattended systems.

4. **Mail Status**:
   Information about unread mail or the last time new mail was received is displayed. While this may seem harmless, it could reveal whether a user is regularly checking their system, providing clues about their general presence or engagement with the system.

### Potential Risks
Exposing these details may not be a significant concern in small, trusted environments, but in larger networks or environments with untrusted users, it could lead to security vulnerabilities:
- **Social Engineering Attacks**: Malicious actors may use information from `finger` to craft personalized phishing or social engineering attacks based on a user's activity or login patterns.
- **Timing Attacks**: Knowing when a user is active or idle can help attackers choose the most opportune time to attempt unauthorized access or system manipulation.
- **Targeted Attacks**: If attackers know home directory locations, they might focus on exploiting those specific directories for privilege escalation or data exfiltration.

### Mitigating Privacy Risks

To mitigate these risks, system administrators can take the following steps:

1. **Disable the `finger` Service**:
   If the `finger` command is not required, disabling the `finger` service entirely is the most secure option. In many modern systems, `finger` is disabled by default because it’s considered outdated and potentially insecure.

   On Linux systems, you can disable the `finger` service as follows:
   ```bash
   sudo systemctl disable finger
   sudo systemctl stop finger
