---
title: 'Container Networking: Docker Bridges, Ports and Kubernetes'
description: 'Build a Docker-style bridge network by hand, then see what Docker and Kubernetes do: container DNS, published ports, Services and NetworkPolicies.'
order: 6
---

Containers do not have a special kind of network. A container is a process with its own network namespace, connected to the host by a veth pair, plugged into a bridge, and given access to the outside world with NAT. That is exactly what you have been doing with the lab since Part 1. Docker and Kubernetes automate it and add two things on top: DNS names for containers, and load balancing for groups of them.

In this part you first build a small container network by hand on one of the lab's servers, so that you know what Docker's commands do underneath. Then you look at the real thing: Docker's bridge networks, embedded DNS and published ports, and a Kubernetes cluster's pod network, Services and NetworkPolicies.

## Prerequisites

- A fresh lab from [Part 1](/guides/networking-fundamentals/01-network-fundamentals-and-protocols#h2-build-the-practice-lab): run `sudo ./netlab.sh down && sudo ./netlab.sh up` before you start, because every part changes the lab.
- NAT from [Part 2](/guides/networking-fundamentals/02-ip-addressing-and-subnetting#h2-nat-private-addresses-on-the-internet).
- To repeat the Docker and Kubernetes sections: Docker Engine (see the [Docker installation part](/guides/introduction-to-docker/02-docker-installation)) and [kind](https://kind.sigs.k8s.io/) for a local cluster. Their output in this part comes from the guide's companion repository, whose GitHub Actions workflow ran every command on a fresh Ubuntu 26.04 runner (Docker Engine and kind v0.33.0 with Kubernetes 1.37).

## A Container Network by Hand

Pretend `web1` is a Docker host. Docker would create a bridge called `docker0`, give each container a namespace with an address from a private range, and add NAT rules. Do the same with two "containers", `ctr1` and `ctr2`. Run this script on your machine (not inside a lab host), as root:

```bash
#!/usr/bin/env bash
# containers.sh: what Docker does when it starts two containers on web1
set -euo pipefail

# the bridge: Docker's docker0, with the gateway address for the containers
ip -n web1 link add br0 type bridge
ip -n web1 addr add 172.18.0.1/16 dev br0
ip -n web1 link set br0 up
ip netns exec web1 sysctl -qw net.ipv4.ip_forward=1

# one namespace per container, a veth pair into the bridge, an address and a default route
n=2
for c in ctr1 ctr2; do
  ip netns add "$c"
  echo "$c" >> /var/lib/netlab/namespaces   # so that "netlab.sh down" removes it too
  ip -n "$c" link set lo up
  ip -n web1 link add "veth-$c" type veth peer name eth0 netns "$c"
  ip -n web1 link set "veth-$c" master br0 up
  ip -n "$c" addr add "172.18.0.$n/16" dev eth0
  ip -n "$c" link set eth0 up
  ip -n "$c" route add default via 172.18.0.1
  n=$((n + 1))
done

# NAT on web1: containers reach the outside as web1, and port 8081 is published to ctr1:80
ip netns exec web1 nft -f - <<'NFT'
table ip containers {
    chain prerouting {
        type nat hook prerouting priority dstnat; policy accept;
        tcp dport 8081 dnat to 172.18.0.2:80
    }
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        ip saddr 172.18.0.0/16 oifname != "br0" masquerade
    }
}
NFT

# the "container" process: the lab app on port 80 in ctr1
ip netns exec ctr1 setsid python3 /etc/netlab/app.py http ctr1 80 >>/run/netlab/log/ctr1-app.log 2>&1 </dev/null &
```

```terminal
{
  "title": "run it, then test every path",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "$",
      "cmd": "sudo bash containers.sh"
    },
    {
      "comment": "container to container, on the same bridge",
      "prompt": "ctr2#",
      "cmd": "curl -s http://172.18.0.2/",
      "output": "served by ctr1 (172.18.0.2)"
    },
    {
      "comment": "another machine, through the published port on web1",
      "prompt": "web2#",
      "cmd": "curl -s http://10.0.2.11:8081/",
      "output": "served by ctr1 (172.18.0.2)"
    },
    {
      "comment": "container to the internet: NAT on web1, then NAT on the router",
      "prompt": "ctr1#",
      "cmd": "curl -s http://203.0.113.20/",
      "output": "served by remote (203.0.113.20)"
    },
    {
      "prompt": "remote#",
      "cmd": "tail -n 1 /run/netlab/log/remote-app.log",
      "output": "203.0.113.1 xff=- \"GET / HTTP/1.1\" 200 -"
    }
  ]
}
```

Every Docker networking feature is in those few lines:

- **The bridge** `br0` is a virtual switch; containers on it reach each other directly by IP, like hosts on one subnet (Part 2).
- **Outbound access** is source NAT: `ctr1`'s packets leave `web1` with `web1`'s address, and then the lab router translates them again to `203.0.113.1`, which is what `remote` logged. Two layers of NAT are normal for a container on a cloud VM.
- **Publishing a port** (`docker run -p 8081:80`) is destination NAT: connections to port 8081 on the host go to the container's port 80.

Two consequences surprise people when they debug containers. First, a published port has no listening socket on the host when it is plain DNAT:

```terminal
{
  "title": "nothing listens on 8081, yet it answers",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "prompt": "web1#",
      "cmd": "ss -tln",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:Port\nLISTEN 0      5            0.0.0.0:8080      0.0.0.0:*"
    },
    {
      "prompt": "web1#",
      "cmd": "nft list table ip containers",
      "output": "table ip containers {\n\tchain prerouting {\n\t\ttype nat hook prerouting priority dstnat; policy accept;\n\t\ttcp dport 8081 dnat to 172.18.0.2:80\n\t}\n\n\tchain postrouting {\n\t\ttype nat hook postrouting priority srcnat; policy accept;\n\t\tip saddr 172.18.0.0/16 oifname != \"br0\" masquerade\n\t}\n}"
    }
  ]
}
```

`ss` on `web1` shows the app on 8080 and nothing on 8081: the kernel rewrites the packets before any socket sees them. (Docker also starts a small `docker-proxy` process for each published port, so on a Docker host `ss -tlnp` does show it. Kubernetes NodePorts usually show nothing.) To find out where a port goes, read the NAT rules.

Second, the published traffic goes through the host's `forward` path, not `input`. That is why host firewalls such as ufw, which filter `input`, do not protect published container ports (Part 4).

### The Most Common Container Networking Bug

A program inside a container that listens on `127.0.0.1` cannot be reached from outside the container, published port or not. The container's loopback is its own, not the host's. Start a second app in `ctr2` that listens on loopback only, publish it, and try:

```terminal
{
  "title": "listening on the container's loopback",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "comment": "a server that listens on loopback only",
      "prompt": "ctr2#",
      "cmd": "python3 -m http.server 80 --bind 127.0.0.1 &"
    },
    {
      "prompt": "web1#",
      "cmd": "nft add rule ip containers prerouting tcp dport 8082 dnat to 172.18.0.3:80"
    },
    {
      "prompt": "web2#",
      "cmd": "nc -zv -w 3 10.0.2.11 8082",
      "output": "nc: connect to 10.0.2.11 port 8082 (tcp) failed: Connection refused"
    },
    {
      "prompt": "ctr2#",
      "cmd": "ss -tln",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:Port\nLISTEN 0      5          127.0.0.1:80        0.0.0.0:*"
    }
  ]
}
```

The packet reached `ctr2` and found nothing on `172.18.0.3:80`, so the kernel answered with a reset. The fix is in the application, not the network: listen on `0.0.0.0` (all addresses) inside containers. Frameworks that default to `localhost` in development (Flask, Vite, Rails and others) need `--host 0.0.0.0` in a container.

## Docker Networks

Docker creates three networks on install:

```terminal
{
  "title": "Docker's networks (companion repo, Ubuntu 26.04 runner)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker version --format '{{.Server.Version}}'",
      "output": "29.4.2"
    },
    {
      "cmd": "docker network ls",
      "output": "NETWORK ID     NAME      DRIVER    SCOPE\n3ef5359989e8   bridge    bridge    local\n2a2b2f3a84a7   host      host      local\ndc155de91926   none      null      local"
    }
  ]
}
```

- `bridge` is the default `docker0` network. Containers on it get addresses from `172.17.0.0/16` but **no DNS names** for each other.
- `host` puts the container in the host's network namespace: no isolation, no NAT, no port publishing needed. Useful for network tools and some high-throughput services.
- `none` gives the container only a loopback interface.

Always create your own networks. A **user-defined bridge** gets its own subnet and an **embedded DNS server** at `127.0.0.11` that resolves container names:

```terminal
{
  "title": "a user-defined network with DNS",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker network create shop",
      "output": "e0c8e2e47843503b3f6cfba87bbba42a2166a1f11babb67e6ee620d72a244f29"
    },
    {
      "cmd": "docker network inspect shop --format '{{json .IPAM.Config}}'",
      "output": "[{\"Subnet\":\"172.18.0.0/16\",\"Gateway\":\"172.18.0.1\"}]"
    },
    {
      "cmd": "docker run -d --name api --network shop traefik/whoami:v1.12.0",
      "output": "e22845bd982d0c7555f7071880a3b277109c2fc5f66baf389e2a072b8ed23e36"
    },
    {
      "cmd": "docker run --rm --network shop busybox:1.38 cat /etc/resolv.conf",
      "output": "# Generated by Docker Engine.\n# This file can be edited; Docker Engine will not make further changes once it\n# has been modified.\n\nnameserver 127.0.0.11\nsearch c4pcceq4ihwedioehcz0iaacqc.bx.internal.cloudapp.net\noptions edns0 trust-ad ndots:0\n\n# Based on host file: '/etc/resolv.conf' (internal resolver)\n# ExtServers: [host(127.0.0.53)]\n# Overrides: []\n# Option ndots from: internal"
    },
    {
      "cmd": "docker run --rm --network shop alpine:3.24 getent hosts api",
      "output": "172.18.0.2        api  api"
    },
    {
      "cmd": "docker run --rm --network shop busybox:1.38 wget -qO- http://api",
      "output": "Hostname: e22845bd982d\nIP: 127.0.0.1\nIP: ::1\nIP: 172.18.0.2\nRemoteAddr: 172.18.0.3:37716\nGET / HTTP/1.1\nHost: api\nUser-Agent: Wget\nConnection: close"
    }
  ]
}
```

The network got the next free range from Docker's default pools (`172.18.0.0/16`). The container's `resolv.conf` points at `127.0.0.11`, Docker's resolver, which answers container names on the network and forwards everything else to the host's DNS servers. `whoami` prints what the container sees: its hostname (the container ID), its addresses and the request headers.

On the default bridge, the same lookup fails:

```terminal
{
  "title": "the default bridge has no container DNS",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker run -d --name api-default traefik/whoami:v1.12.0",
      "output": "dfd3ced96933217114337c8656f49ba3403640e91a2997834c9fb2901acd2002"
    },
    {
      "cmd": "docker run --rm alpine:3.24 getent hosts api-default || echo \"api-default: not found\"",
      "output": "api-default: not found"
    }
  ]
}
```

The old fix for that, `--link`, is a legacy feature; use a user-defined network instead.

### Publishing Ports

`-p` publishes a container port on the host. Without an address, Docker publishes on every host address, which on a server with a public IP means the internet. Publish internal services on `127.0.0.1` and put a proxy in front:

```terminal
{
  "title": "publish on loopback only",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker run -d --name web -p 127.0.0.1:8080:80 traefik/whoami:v1.12.0",
      "output": "d43fa6a8c3c2a967944c522d9549297ec514d8d117588ca0afd09de05da21077"
    },
    {
      "cmd": "docker port web",
      "output": "80/tcp -> 127.0.0.1:8080"
    },
    {
      "cmd": "curl -s http://127.0.0.1:8080/ | grep -E '^(Hostname|IP: 172|RemoteAddr)'",
      "output": "Hostname: d43fa6a8c3c2\nIP: 172.17.0.3\nRemoteAddr: 172.17.0.1:43936"
    },
    {
      "cmd": "sudo ss -tlnp 'sport = :8080'",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess\nLISTEN 0      4096       127.0.0.1:8080      0.0.0.0:*    users:((\"docker-proxy\",pid=3321,fd=8))"
    },
    {
      "cmd": "sudo iptables -t nat -S DOCKER",
      "output": "-N DOCKER\n-A DOCKER -d 127.0.0.1/32 ! -i docker0 -p tcp -m tcp --dport 8080 -j DNAT --to-destination 172.17.0.3:80"
    }
  ]
}
```

The same pieces as in the hand-built network: a DNAT rule for the published port (Docker writes it with `iptables`, which on Ubuntu 26.04 is the nftables backend) and the `docker-proxy` process listening on the port. `RemoteAddr` in the `whoami` output is the bridge gateway, `172.17.0.1`: the request came in through NAT on the host.

### Internal Networks and Compose

A network created with `--internal` has no way out. Containers on it can talk to each other but not to the internet, which suits databases:

```terminal
{
  "title": "an internal network has no way out",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker network create --internal backend",
      "output": "94cd77200a932b63607f6d4fb26a21c35b0e6fe072bed2e8880a16c08bbb7510"
    },
    {
      "cmd": "docker run --rm --network backend busybox:1.38 wget -T 3 -qO- http://example.com",
      "output": "wget: bad address 'example.com'"
    },
    {
      "cmd": "docker run --rm --network backend busybox:1.38 wget -T 3 -qO- http://1.1.1.1",
      "output": "wget: can't connect to remote host (1.1.1.1): Network is unreachable"
    }
  ]
}
```

Both ways out are closed: Docker's DNS server does not resolve external names for an internal network, and there is no route for a direct address either.

Docker Compose creates a network per project, and you can split a stack into tiers the same way the lab splits its subnets. The proxy can reach the API, the API can reach the database, and the proxy cannot reach the database:

```yaml
services:
  proxy:
    image: nginx:1.30-alpine
    ports:
      - '127.0.0.1:8081:80'
    networks: [front]
  api:
    image: traefik/whoami:v1.12.0
    networks: [front, back]
  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_PASSWORD: example
    networks: [back]

networks:
  front: {}
  back:
    internal: true
```

```terminal
{
  "title": "tiers as networks (in a directory named shop)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "docker compose up -d --quiet-pull",
      "output": " Network shop_back Creating\n Network shop_back Created\n Network shop_front Creating\n Network shop_front Created\n Container shop-api-1 Creating\n Container shop-db-1 Creating\n Container shop-proxy-1 Creating\n Container shop-api-1 Created\n Container shop-db-1 Created\n Container shop-proxy-1 Created\n Container shop-db-1 Starting\n Container shop-api-1 Starting\n Container shop-proxy-1 Starting\n Container shop-db-1 Started\n Container shop-proxy-1 Started\n Container shop-api-1 Started"
    },
    {
      "cmd": "docker run --rm --network shop_front alpine:3.24 getent hosts db || echo \"db: not found\"",
      "output": "db: not found"
    },
    {
      "cmd": "docker run --rm --network shop_back alpine:3.24 getent hosts db",
      "output": "172.20.0.2        db  db"
    }
  ]
}
```

Compose names networks after the project directory (`shop_front`, `shop_back`), and each service is reachable by its service name on the networks it joins. There is no `version:` line at the top: the Compose Specification ignores it, and current Compose warns that it is obsolete.

If Docker's default ranges clash with your VPC or VPN (Part 2 found exactly that), move them in `/etc/docker/daemon.json` before you create networks. Write the file there (merge it with any settings it already has), and check it before you restart Docker:

```json
{
  "bip": "192.168.240.1/24",
  "default-address-pools": [{ "base": "192.168.248.0/21", "size": 24 }]
}
```

```terminal
{
  "title": "validate the daemon configuration",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo dockerd --validate --config-file /etc/docker/daemon.json",
      "output": "configuration OK"
    }
  ]
}
```

`bip` moves the default bridge, and `default-address-pools` gives new networks /24 blocks from `192.168.248.0/21` (eight networks). Restart Docker after changing it; existing networks keep their old ranges until you recreate them.

## Kubernetes Networking

Kubernetes sets three rules, and the network plugin (**CNI**) implements them:

1. Every pod gets its own IP address.
2. Pods can reach every other pod by that address, on any node, without NAT.
3. Agents on a node (such as the kubelet) can reach every pod on that node.

How the plugin does it differs: kind's **kindnet** and **Flannel** route a subnet per node, **Calico** routes with BGP or tunnels, **Cilium** uses eBPF, and the AWS VPC CNI hands out real VPC addresses (Part 7). A three-node kind cluster shows the result. Create it from this config (one control plane, two workers):

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

```bash
kind create cluster --name net --config kind.yaml --wait 180s
```

Then deploy three replicas of `whoami` with a Service in front of them:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: whoami
          image: traefik/whoami:v1.12.0
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: shop
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

```terminal
{
  "title": "nodes, pods and their addresses (kind, Kubernetes 1.37)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "kubectl wait --for=condition=Ready nodes --all --timeout=180s",
      "output": "node/net-control-plane condition met\nnode/net-worker condition met\nnode/net-worker2 condition met"
    },
    {
      "cmd": "kubectl get nodes -o wide",
      "output": "NAME                STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE                       KERNEL-VERSION             CONTAINER-RUNTIME\nnet-control-plane   Ready    control-plane   28s   v1.37.0   172.18.0.3    <none>        Debian GNU/Linux 13 (trixie)   7.0.0-1017-azure (amd64)   containerd://2.3.4\nnet-worker          Ready    <none>          14s   v1.37.0   172.18.0.4    <none>        Debian GNU/Linux 13 (trixie)   7.0.0-1017-azure (amd64)   containerd://2.3.4\nnet-worker2         Ready    <none>          14s   v1.37.0   172.18.0.2    <none>        Debian GNU/Linux 13 (trixie)   7.0.0-1017-azure (amd64)   containerd://2.3.4"
    },
    {
      "cmd": "kubectl create namespace shop",
      "output": "namespace/shop created"
    },
    {
      "cmd": "kubectl apply -f web.yaml",
      "output": "deployment.apps/web created\nservice/web created"
    },
    {
      "cmd": "kubectl -n shop rollout status deployment/web --timeout=180s",
      "output": "Waiting for deployment \"web\" rollout to finish: 0 of 3 updated replicas are available...\nWaiting for deployment \"web\" rollout to finish: 1 of 3 updated replicas are available...\nWaiting for deployment \"web\" rollout to finish: 2 of 3 updated replicas are available...\ndeployment \"web\" successfully rolled out"
    },
    {
      "cmd": "kubectl -n shop get pods -o wide",
      "output": "NAME                   READY   STATUS    RESTARTS   AGE   IP           NODE          NOMINATED NODE   READINESS GATES\nweb-6855f5489b-djpmg   1/1     Running   0          3s    10.244.1.2   net-worker2   <none>           <none>\nweb-6855f5489b-ggz65   1/1     Running   0          3s    10.244.1.3   net-worker2   <none>           <none>\nweb-6855f5489b-hv6mx   1/1     Running   0          3s    10.244.2.2   net-worker    <none>           <none>"
    }
  ]
}
```

The nodes are containers on a Docker network (`172.18.0.0/16` on the runner), and each node gives its pods addresses from its own slice of `10.244.0.0/16`. A pod on one node reaches a pod on another directly, because kindnet adds a route per node.

### Services: a Stable Name and Address

Pods come and go, and their addresses change. A **Service** gives a group of pods (selected by labels) one stable virtual address, the **ClusterIP**, and a DNS name. **kube-proxy** on every node programs NAT rules that send connections for the ClusterIP to one of the pods, which makes a Service a layer 4 load balancer (Part 5). The current list of pod addresses lives in **EndpointSlices**:

```terminal
{
  "title": "a Service, its EndpointSlice, and DNS",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "kubectl -n shop get service web",
      "output": "NAME   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE\nweb    ClusterIP   10.96.123.175   <none>        80/TCP    3s"
    },
    {
      "cmd": "kubectl -n shop get endpointslices -l kubernetes.io/service-name=web",
      "output": "NAME        ADDRESSTYPE   PORTS   ENDPOINTS                          AGE\nweb-mdvmn   IPv4          80      10.244.2.2,10.244.1.2,10.244.1.3   3s"
    },
    {
      "cmd": "kubectl -n shop run client --image=busybox:1.38 --labels app=client -- sleep 3600",
      "output": "pod/client created"
    },
    {
      "cmd": "kubectl -n shop wait --for=condition=Ready pod/client --timeout=120s",
      "output": "pod/client condition met"
    },
    {
      "cmd": "kubectl -n shop exec client -- cat /etc/resolv.conf",
      "output": "search shop.svc.cluster.local svc.cluster.local cluster.local v4y24wvpnsfuti3wepf0coreea.gx.internal.cloudapp.net\nnameserver 10.96.0.10\noptions ndots:5"
    },
    {
      "cmd": "kubectl -n shop exec client -- nslookup web.shop.svc.cluster.local",
      "output": "Server:\t\t10.96.0.10\nAddress:\t10.96.0.10:53\n\n\nName:\tweb.shop.svc.cluster.local\nAddress: 10.96.123.175"
    },
    {
      "cmd": "for i in 1 2 3 4 5 6; do kubectl -n shop exec client -- wget -qO- http://web | grep Hostname; done",
      "output": "Hostname: web-6855f5489b-ggz65\nHostname: web-6855f5489b-djpmg\nHostname: web-6855f5489b-ggz65\nHostname: web-6855f5489b-djpmg\nHostname: web-6855f5489b-ggz65\nHostname: web-6855f5489b-djpmg"
    },
    {
      "cmd": "kubectl -n kube-system get configmap kube-proxy -o jsonpath='{.data.config\\.conf}' | grep '^mode'",
      "output": "mode: iptables"
    }
  ]
}
```

- The Service's ClusterIP comes from the service range (`10.96.0.0/16` in kind), separate from the pod range. It is virtual: no interface has it, and you cannot ping it.
- The EndpointSlice lists the three pod addresses that back the Service right now. (The older `Endpoints` API is deprecated since Kubernetes 1.33.)
- The pod's `resolv.conf` points at the cluster DNS Service (CoreDNS) and has three cluster search domains (plus the node's own, here the runner's cloud domain) with `ndots:5`, so the short name `web` works inside the namespace. Part 3 explained what that costs for external names.
- The requests spread over the pods, chosen by kube-proxy's rules. kind still runs kube-proxy in `iptables` mode by default; the `nftables` mode, generally available since Kubernetes 1.33, does the same with nftables and scales better with many Services.

Other Service types build on the ClusterIP: **NodePort** opens the same port on every node, **LoadBalancer** asks the cloud for a load balancer that points at those node ports, and a **headless** Service (`clusterIP: None`) skips the virtual address and returns the pod addresses straight from DNS. For HTTP traffic from outside the cluster, use the **Gateway API** (the successor of Ingress); the [Kubernetes Services and networking part](/guides/introduction-to-kubernetes/05-services-and-networking) of the Kubernetes guide sets one up.

### NetworkPolicy: a Firewall for Pods

By default every pod can reach every other pod. A **NetworkPolicy** selects pods by label and lists who may connect to them; once a pod is selected by any policy for a direction, everything not allowed is denied. The usual pattern is a default deny for the namespace plus one allow rule per real connection, the same idea as the router rules in Part 4:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-from-client
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: client
      ports:
        - protocol: TCP
          port: 80
```

```terminal
{
  "title": "allowed and blocked, by label",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "kubectl apply -f netpol.yaml",
      "output": "networkpolicy.networking.k8s.io/default-deny-ingress created\nnetworkpolicy.networking.k8s.io/web-from-client created"
    },
    {
      "cmd": "kubectl -n shop run intruder --image=busybox:1.38 --labels app=intruder -- sleep 3600",
      "output": "pod/intruder created"
    },
    {
      "cmd": "kubectl -n shop wait --for=condition=Ready pod/intruder --timeout=120s",
      "output": "pod/intruder condition met"
    },
    {
      "cmd": "kubectl -n shop exec client -- wget -qO- -T 3 http://web | grep Hostname",
      "output": "Hostname: web-6855f5489b-djpmg"
    },
    {
      "cmd": "kubectl -n shop exec intruder -- wget -qO- -T 3 http://web",
      "output": "wget: download timed out\ncommand terminated with exit code 1"
    }
  ]
}
```

The `client` pod still gets an answer; the `intruder` pod, with a different label, times out. NetworkPolicies only work if the CNI enforces them: kindnet does since kind v0.24, Calico and Cilium do, and Flannel alone does not, in which case the policies are accepted and silently ignored. Test a deny rule once after you install a cluster. If you restrict **egress** too, remember to allow DNS (UDP and TCP port 53 to the cluster DNS pods), or every lookup fails.

## Debugging Container Networks

Container images are small and usually have no `ss`, `dig` or `tcpdump`. Three ways around that:

- **Run host tools inside the container's network namespace** with `nsenter`. You keep the host's tools and see the container's interfaces and sockets:

```terminal
{
  "title": "the container's sockets, with the host's ss",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    {
      "cmd": "sudo nsenter -t \"$(docker inspect -f '{{.State.Pid}}' web)\" -n ss -tln",
      "output": "State  Recv-Q Send-Q Local Address:Port Peer Address:Port\nLISTEN 0      4096               *:80              *:*"
    }
  ]
}
```

- **Start a debug container that shares the network namespace**: `docker run --rm -it --network container:web nicolaka/netshoot` for Docker, and `kubectl debug -it <pod> --image=nicolaka/netshoot --target=<container>` for Kubernetes, which adds an ephemeral container to a running pod.
- **Capture on the host side**: every container's traffic crosses its veth interface and the bridge on the host, so `tcpdump -i docker0` (or the pod's `veth` or `lxc` interface on a Kubernetes node) sees it.

Overlay networks (VXLAN, Geneve, WireGuard) wrap each packet in another header, which lowers the usable MTU from 1500 to around 1450 or 1420 bytes. If small requests work and large responses hang, suspect the MTU; Part 8 shows how to find it with `tracepath`.

## Clean Up

The Docker and Kubernetes examples keep running until you remove them. In the `shop` directory, and then anywhere:

```bash
docker compose down
docker rm -f api api-default web
docker network rm shop backend
kind delete cluster --name net
```

`sudo ./netlab.sh down` removes the lab, including `ctr1` and `ctr2`, which `containers.sh` registered.

## Common Mistakes

- **Listening on `127.0.0.1` inside a container.** Listen on `0.0.0.0`; the container's loopback is not the host's.
- **Using the default bridge.** It has no container DNS. Create a network per application.
- **Publishing databases on all host addresses.** `-p 5432:5432` exposes the database to every network the host is on, and Docker's NAT rules skip ufw. Publish on `127.0.0.1`, or not at all.
- **Overlapping address ranges** between Docker, Kubernetes, the VPC and VPNs. Plan them (Part 2) and set `default-address-pools`.
- **Assuming NetworkPolicies work.** Test a deny once; with a CNI that does not enforce them, they do nothing.
- **Hardcoding pod IPs.** Use Service names; pod addresses change on every restart.

## Summary

- A container is a network namespace with a veth pair into a bridge; outbound traffic uses source NAT, published ports use destination NAT.
- Docker's user-defined networks add DNS at `127.0.0.11`; `--internal` networks have no way out; Compose builds tiers from networks.
- Kubernetes gives every pod an address reachable from every other pod; Services add a stable virtual IP, DNS name and load balancing through kube-proxy, backed by EndpointSlices.
- NetworkPolicies are pod firewalls selected by labels, enforced only by CNIs that support them.
- Debug with `nsenter`, a netshoot container, or a capture on the host side of the veth.

Next, [Part 7](/guides/networking-fundamentals/07-cloud-networking) maps the lab onto a cloud VPC.

## Keep Learning

- Simulators: [Kubernetes networking and CNI](/games/kubernetes-networking-cni-simulator), [Docker under the hood](/games/docker-under-the-hood-simulator)
- Interview questions: [Kubernetes Services and networking](/interview-questions/mid/kubernetes-services-networking)
- [Networking in Docker](/guides/introduction-to-docker/07-networking-in-docker) in the Introduction to Docker guide
