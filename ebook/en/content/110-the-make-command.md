# The `make` command

The `make` command is used to automate the reuse of multiple commands in certain directory structure.

An example for that would be the use of `terraform init`, `terraform plan`, and `terraform validate` while having to change different subscriptions in Azure. This is usually done in the following steps:

```
az account set --subscription "Subscription - Name"
terraform init
```

How the `make` command can help us is it can automate all of that in just one go:
```make tf-init```

### Syntax:

```
make [ -f makefile ] [ options ] ... [ targets ] ...
```

### Example use (guide):

#### 1. Create `Makefile` in your guide directory
#### 2. Include the following in your `Makefile` :
```
hello-world:
        echo "Hello, World!"

hello-bobby:
        echo "Hello, Bobby!"

touch-letter:
        echo "This is a text that is being inputted into our letter!" > letter.txt

clean-letter:
        rm letter.txt
```
#### 3. Execute ```make hello-world``` - this echoes "Hello, World" in our terminal.
#### 4. Execute ```make hello-bobby``` - this echoes "Hello, Bobby!" in our terminal.
#### 5. Execute ```make touch-letter``` - This creates a text file named `letter.txt` and populates a line in it.
#### 6. Execute ```make clean-letter```

```bash
$ nc -p 1337 -w 5 host.ip 80
```



### Flags and their Functionalities:

| **Short Flag** | **Description**                                                   |
| -------------- | ----------------------------------------------------------------- |
| `-4`           | Forces nc to use IPv4 addresses                                   |
| `-6`           | Forces nc to use IPv6 addresses                                   |
| `-b`           | Allow broadcast                                                   |
| `-D`           | Enable debugging on the socket                                    |
| `-i`           | Specify time interval delay between lines sent and received       |
| `-k`           | Stay listening for another connection after current is over       |
| `-l`           | Listen for incoming connection instead of initiate one to remote  |
| `-T`           | Specify length of TCP                                             |
| `-p`           | Specify source port to be used                                    |
| `-r`           | Specify source and/or destination ports randomly                  |
| `-s`           | Specify IP of interface which is used to send the packets         |
| `-U`           | Use UNIX-domain sockets                                           |
| `-u`           | Use UDP instead of TCP as protocol                                |
| `-w`           | Declare a timeout threshold for idle or unestablished connections |
| `-x`           | Should use specified protocol when talking to proxy server        |
| `-z`           | Specify to scan for listening daemons, without sending any data   |
