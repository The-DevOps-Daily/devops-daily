# The `curl` command

In linux, `curl` is a tool to transfer data from or to a server, using one of the supported protocols(DICT, FILE ,FTP, FTPS, GOPHER, HTTP, HTTPS, IMAP, IMAPS, LDAP, LDAPS, POP3, POP3S, RTMP, RTSP, SCP, SFTP, SMB, SMBS, SMTP, SMTPS, TELNET and TFTP).

## Example :

```bash
$ curl example.com
```

The command will print the source code of the example.com homepage in the terminal window.

## The syntax of the `curl` command is :

```bash
$ curl [options...] <url>
```

## Options :

Options start with one or two dashes. Many of the options require an additional value next to them.

The short "single-dash" form of the options, `-d` for example, may be used with or without a space between it and its value, although a space is a recommended separator. The long "double-dash" form, `-d`, `--data` for example, requires a space between it and its value.

Short version options that don't need any additional values can be used immediately next to each other, like for example you can specify all the options `-O`, `-L` and `-v` at once as `-OLv`.

In general, all boolean options are enabled with `--option` and yet again disabled with `--no-option`. That is, you use the exact same option name but prefix it with `no-`. However, in this list we mostly only list and show the `--option` version of them. (This concept with `--no` options was added in 7.19.0. Previously most options were toggled on/off through repeated use of the same command line option.)

|**Tag**	|**Description**|
|:---|:---|
|**url**|	One or multiple URLs that will be fetched in sequence. Multiple URLs or parts of URLs can be specified by writing part sets within braces as in: `http://site.{one,two,three}.com` or get sequences of alphanumeric series by using [] as in: `ftp://ftp.numericals.com/file[1-100].txt` `ftp://ftp.numericals.com/file[001-100].txt` (with leading zeros) `ftp://ftp.letters.com/file[a-z].txt`|
|**-A "agent string"** <br> **--user-agent "agent string"**| Specify the User-Agent string to send to the HTTP server. To encode blanks in the string, surround the string with single quote marks. This can also be set with `-H`, `--header` option. (HTTP)|
|**-b name=data <br> --cookie name=data**| Send the data to the HTTP server as a cookie. It is supposedly the data previously received from the server in a "Set-Cookie:" line. The data should be in the format "NAME1=VALUE1; NAME2=VALUE2".|
|**-c filename <br> --cookie-jar file name**| Save cookies to file after a completed operation. Curl writes all cookies previously read from a specified file as well as all cookies received from remote server(s). If no cookies are known, no file will be written. To write to `stdout`, set the file name to a single dash, `-`.|
|**--compressed**| Request a compressed response using one of the algorithms curl supports (gzip), and save the uncompressed document. If this option is used and the server sends an unsupported encoding, curl will report an error.(HTTP)|
|**-d @file <br> -d "string" <br> --data "string"**| Send the specified data in an (HTTP) POST request, in the same way that a web browser does. This will pass the data using the content-type `application/x-www-form-urlencoded`. Compare to `-F`, `--form`.|
|**-d, --data is the same as --data-ascii. <br> To post data in pure binary, use --data-binary.**| To URL-encode the value of a form field you may use `--data-urlencode`. Multiple date options will be merged together. Thus, using `-d name=daniel -d skill=lousy` would generate a post that looks like `name=daniel&skill=lousy`. If the data starts with @, the rest should be a filename containing the data.|
|**-F name=@file <br> -F name=content <br> --form name=content**| Emulate a filled-in form in which a user has pressed the submit button. This will POST data using the Content-Type multipart/form-data according to RFC 2388. This enables uploading of binary files etc. If the data starts with @, the rest should be a filename. To just get the content part from a file, prefix the file name with the symbol <. The difference between @ and < is that @ makes a file get attached in the post as a file upload, while the < makes a text field and gets the contents for that text field from a file.|
|**-k <br> --insecure**| This option explicitly allows curl to perform "insecure" SSL connections and transfers. All SSL connections are attempted in secure mode using the CA certificate bundle installed by default. This makes all connections considered "insecure" fail unless `-k`, `--insecure` is used.(SSL).|
|**--limit-rate speed <br> -m seconds <br> --max-time seconds**| Specify the maximum transfer rate. This feature is useful if you have a limited pipe and you'd like your transfer not to use your entire bandwidth. The given speed is measured in bytes/second, unless a suffix is appended. Appending 'k' or 'K' will count the number as kilobytes/sec, 'm' or M' megabytes, while 'g' or 'G' makes it gigabytes/sec. Eg: 200K, 3m, 1G.|
|**-o file <br> --output file**| Write output to file instead of stdout. If you are using {} or [] to fetch multiple documents, you can use '#' followed by a number in the file specifier. That variable will be replaced with the current string for the URL being fetched. Like in: `curl http://{one,two}.site.com -o "file_#1.txt"` or use several variables like: `curl http://{site,host}.host[1-5].com -o "#1_#2"` You may use this option as many times as the number of URLs you have. See also `--create-dirs` option to create the local directories dynamically. Specify `-` to force the output to stdout.|
|**-O <br> --remote-name**|	Write output to a local file named like the remote file we get. (Only the file part of the remote file is used, the path is cut off.) The remote file name to use for saving is extracted from the given URL, nothing else. Consequentially, the file will be saved in the current working directory.|
|**-s <br> --silent**|	Silent or quiet mode. Don't show progress meter or error messages.|
|**--trace-ascii file**| Enable a full trace dump of all incoming and outgoing data, including descriptive information, to the given output file. Use `-` as filename to have the output sent to stdout. This option overrides previous uses of `-v`, `--verbose` or `--trace-ascii`. If this option is used several times, the last one will be used.|
|**-T file <br> --upload-file file**| Transfer the specified local file to the remote URL. PUT If there is no file part in the specified URL, Curl will append the local file name. You must use a trailing `/` on the last directory to really prove to Curl that there is no file name or curl will think that the last directory name is the remote file name to use. Use the file name `-` to use stdin. You can specify one -T for each URL on the command line. Each `-T + URL` pair specifies what to upload and to where. curl also supports "globbing" of the `-T` argument, meaning that you can upload multiple files to a single URL like this: <br> `curl -T "{file1,file2}" http://www.uploadtothissite.com` <br> or even <br> `curl -T "img[1-1000].png" ftp://ftp.picturemania.com/upload/`|
|**-I <br> --head**| Fetch the HTTP-header only! (HTTP/FTP/FILE) HTTP-servers feature the command HEAD which this uses to get nothing but the header of a document. When used on an FTP or FILE file, curl displays the file size and last modification time only.|
|**-u user:password <br> --user user:password**| The username and password to use for server authentication. Overrides `-n`, `--netrc` and `--netrc-optional`. If you just give the user name (without entering a colon) curl will prompt for a password. If you use an SSPI-enabled curl binary and do NTLM authentication, you can force curl to pick up the username and password from your environment by specifying a single colon with this option: `-u :`. If this option is used several times, the last one will be used.|
|**-w <br> --write-out format**| Define extra info to display on stdout after a completed and successful operation. The format is a string that may contain plain text mixed with any number of variables. The format string can be specified as "string", or to read from a file specify `@filename` to read the format from stdin use `@-`. Various variables may be included in the format and will be substituted by curl (file size, ip address etc see man curl for details). variables are specified as `%{variable_name}` Output a newline using `\n`, a carriage return with `\r` and a tab space with `\t`.|
|**-x host:port <br> -x [protocol://][user:password@]proxyhost[:port] <br> --proxy [protocol://][user:password@]proxyhost[:port]**| Use the specified HTTP proxy. If the port number is not specified, it is assumed at port 1080.|
|**-H "name: value" <br> --header "name: value"**| Add Header when getting a web page. You may specify any number of extra headers.|
|**-H "name:" <br> --header "name:"**|	Remove Header, remove an internal header.|
|**-L <br> --location**| Follow redirects if the server reports that the requested page has moved (indicated with a Location: header and a 3XX response code)|
|**-v <br> --verbose**|	Make more verbose/talkative. Mostly useful for debugging.|

## Installation :

The curl command comes with most of the Linux distributions. But, if the system does not carry the curl by default. You need to install it manually. To install the curl, execute the following commands:

Update the system by executing the following commands:

```bash
$ sudo apt update
$ sudo apt upgrade
```
Now, install the curl utility by executing the below command:

```bash
$ sudo apt install curl
```

Verify the installation by executing the below command:

```bash
$ curl -version
```

The above command will display the installed version of the curl command.