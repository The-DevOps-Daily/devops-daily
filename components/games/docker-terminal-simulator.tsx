'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  BookOpen,
  Container,
  Cpu,
  Database,
  FileText,
  HardDrive,
  ListChecks,
  Network,
  Play,
  Server,
  Square,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LAB_TERMINAL_HEIGHT,
  SimComplete,
  SimFrame,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimTerminal,
  labLines,
  labStats,
  lessonsSummary,
  useSimLab,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';
import { useTerminalSimulator, type ExecuteResult } from '@/hooks/use-terminal-simulator';

type ContainerStatus = 'running' | 'exited' | 'created';

interface DockerImage {
  repository: string;
  tag: string;
  id: string;
  created: string;
  size: string;
  layers: string[];
  description: string;
}

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  command: string;
  status: ContainerStatus;
  created: string;
  ports: string[];
  env: Record<string, string>;
  network: string;
  volumes: string[];
  logs: string[];
  health?: 'starting' | 'healthy' | 'unhealthy';
}

interface DockerNetwork {
  name: string;
  driver: 'bridge' | 'host' | 'none';
  containers: string[];
}

interface DockerVolume {
  name: string;
  mountpoint: string;
  usedBy: string[];
}

interface DockerDaemonState {
  images: DockerImage[];
  containers: DockerContainer[];
  networks: DockerNetwork[];
  volumes: DockerVolume[];
  composeRunning: boolean;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  commands: LessonCommand[];
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string | string[];
  explanation: string;
}

const REGISTRY_IMAGES: Record<string, DockerImage> = {
  'hello-world:latest': {
    repository: 'hello-world',
    tag: 'latest',
    id: '9c7a54a9a43c',
    created: '3 weeks ago',
    size: '13.3kB',
    description: 'Minimal image that proves Docker can pull and run containers.',
    layers: ['scratch base', 'hello binary'],
  },
  'nginx:alpine': {
    repository: 'nginx',
    tag: 'alpine',
    id: 'b8c1701fcf89',
    created: '2 weeks ago',
    size: '48.2MB',
    description: 'Small NGINX web server image based on Alpine Linux.',
    layers: ['alpine:3.20', 'nginx package', 'default config', 'html assets'],
  },
  'postgres:16-alpine': {
    repository: 'postgres',
    tag: '16-alpine',
    id: 'f1299d8c7a4e',
    created: '9 days ago',
    size: '274MB',
    description: 'PostgreSQL server image with Alpine base layers.',
    layers: ['alpine:3.20', 'postgres binaries', 'entrypoint scripts', 'database defaults'],
  },
  'redis:7-alpine': {
    repository: 'redis',
    tag: '7-alpine',
    id: '38f7f2b5f7c8',
    created: '11 days ago',
    size: '41.5MB',
    description: 'Redis cache image for lightweight local development.',
    layers: ['alpine:3.20', 'redis package', 'redis.conf', 'entrypoint'],
  },
  'node:20-alpine': {
    repository: 'node',
    tag: '20-alpine',
    id: 'cb7f6f92b18f',
    created: '6 days ago',
    size: '132MB',
    description: 'Node.js runtime used as the base for the sample API image.',
    layers: ['alpine:3.20', 'node runtime', 'npm', 'corepack'],
  },
};

const SAMPLE_DOCKERFILE = `FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm ci --omit=dev
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]`;

const SAMPLE_COMPOSE = `services:
  api:
    image: devops-api:1.0
    ports:
      - "3000:3000"
    networks:
      - appnet
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - appnet

networks:
  appnet:

volumes:
  pgdata:`;

const createInitialState = (): DockerDaemonState => ({
  images: [
    REGISTRY_IMAGES['hello-world:latest'],
    REGISTRY_IMAGES['alpine:3.19'] ?? {
      repository: 'alpine',
      tag: '3.19',
      id: '05455a08881e',
      created: '4 weeks ago',
      size: '7.4MB',
      description: 'Tiny Linux base image often used for containers.',
      layers: ['alpine rootfs'],
    },
  ],
  containers: [
    {
      id: 'd4f33b720a2a',
      name: 'hello-demo',
      image: 'hello-world:latest',
      command: '/hello',
      status: 'exited',
      created: '12 minutes ago',
      ports: [],
      env: {},
      network: 'bridge',
      volumes: [],
      logs: [
        'Hello from Docker!',
        'This message shows that your installation appears to be working correctly.',
      ],
    },
  ],
  networks: [
    { name: 'bridge', driver: 'bridge', containers: [] },
    { name: 'host', driver: 'host', containers: [] },
    { name: 'none', driver: 'none', containers: [] },
  ],
  volumes: [],
  composeRunning: false,
});

export const LESSONS: Lesson[] = [
  {
    id: 'daemon',
    title: 'Docker Daemon Basics',
    description: 'Inspect the local Docker engine and image store',
    icon: <Server className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Start by checking the Docker client and server versions.',
        hint: 'Use "docker version" to see both the client and daemon versions.',
        expectedCommand: 'docker version',
        explanation:
          'Docker CLI commands talk to a daemon. Most troubleshooting starts by proving the client can reach that daemon.',
      },
      {
        instruction: 'Show a summary of the daemon state.',
        hint: 'Use "docker info" to see containers, images, storage driver, and runtime details.',
        expectedCommand: 'docker info',
        explanation:
          'docker info gives a quick health check for the engine: counts, runtime, cgroup driver, and storage driver.',
      },
      {
        instruction: 'Pull a small NGINX image from a registry.',
        hint: 'Use "docker pull nginx:alpine". Tags matter: nginx:latest and nginx:alpine are different images.',
        expectedCommand: 'docker pull nginx:alpine',
        explanation:
          'docker pull downloads image layers from a registry and stores them locally for future containers.',
      },
      {
        instruction: 'List the images now available locally.',
        hint: 'Use "docker images" or "docker image ls".',
        expectedCommand: ['docker images', 'docker image ls'],
        explanation:
          'Images are immutable templates. Containers are runtime instances created from those images.',
      },
    ],
  },
  {
    id: 'lifecycle',
    title: 'Container Lifecycle',
    description: 'Run, inspect, stop, and list containers',
    icon: <Container className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'Run NGINX in the background as a container named web, publishing host port 8080 to container port 80.',
        hint: 'Use "docker run -d --name web -p 8080:80 nginx:alpine".',
        expectedCommand: [
          'docker run -d --name web -p 8080:80 nginx:alpine',
          'docker container run -d --name web -p 8080:80 nginx:alpine',
        ],
        explanation:
          '-d detaches, --name gives the container a stable name, and -p maps traffic from your laptop into the container.',
      },
      {
        instruction: 'List only the running containers.',
        hint: 'Use "docker ps". Add -a later when you also want stopped containers.',
        expectedCommand: ['docker ps', 'docker container ls'],
        explanation:
          'docker ps shows running containers. This is the fastest way to verify a service is currently alive.',
      },
      {
        instruction: 'Read the logs from the web container.',
        hint: 'Use "docker logs web". Container names and IDs both work.',
        expectedCommand: 'docker logs web',
        explanation:
          'Docker captures stdout and stderr from the main process. Logs are usually your first debugging stop.',
      },
      {
        instruction: 'Stop the web container gracefully.',
        hint: 'Use "docker stop web". This sends SIGTERM, then SIGKILL after a timeout.',
        expectedCommand: 'docker stop web',
        explanation:
          'Stopping a container keeps its writable layer around, so you can start it again or inspect it later.',
      },
      {
        instruction: 'List every container, including stopped ones.',
        hint: 'Use "docker ps -a".',
        expectedCommand: ['docker ps -a', 'docker container ls -a'],
        explanation:
          'The -a flag reveals exited containers. This is how you find old runs that may need cleanup.',
      },
    ],
  },
  {
    id: 'debugging',
    title: 'Debugging Containers',
    description: 'Start a container, inspect it, and exec commands inside',
    icon: <Cpu className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Start the web container again.',
        hint: 'Use "docker start web".',
        expectedCommand: 'docker start web',
        explanation:
          'docker start reuses an existing stopped container. docker run creates a new container.',
      },
      {
        instruction: 'Run a command inside the running web container to see its hostname.',
        hint: 'Use "docker exec web hostname".',
        expectedCommand: ['docker exec web hostname', 'docker container exec web hostname'],
        explanation:
          'docker exec starts an extra process inside an existing container. It is useful for quick diagnostics.',
      },
      {
        instruction: 'Inspect the container metadata as JSON-like output.',
        hint: 'Use "docker inspect web".',
        expectedCommand: 'docker inspect web',
        explanation:
          'docker inspect exposes low-level metadata: image ID, network, port bindings, mounts, env vars, and state.',
      },
    ],
  },
  {
    id: 'builds',
    title: 'Build Images',
    description: 'Read a Dockerfile and build a custom API image',
    icon: <FileText className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Read the sample Dockerfile in this workspace.',
        hint: 'Use "cat Dockerfile".',
        expectedCommand: 'cat Dockerfile',
        explanation:
          'A Dockerfile is a recipe for an image. Each instruction can become a cached layer.',
      },
      {
        instruction: 'Build the sample API image and tag it as devops-api:1.0.',
        hint: 'Use "docker build -t devops-api:1.0 .".',
        expectedCommand: [
          'docker build -t devops-api:1.0 .',
          'docker image build -t devops-api:1.0 .',
        ],
        explanation:
          'A tag gives the image a human-friendly name. Without tags, you end up chasing image IDs.',
      },
      {
        instruction: 'Inspect the image layers for devops-api:1.0.',
        hint: 'Use "docker history devops-api:1.0".',
        expectedCommand: 'docker history devops-api:1.0',
        explanation:
          'Layer history helps explain image size, cache hits, and why instruction order matters.',
      },
    ],
  },
  {
    id: 'data-networking',
    title: 'Data & Networking',
    description: 'Create volumes and networks, then run a database container',
    icon: <Database className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Create a named volume for PostgreSQL data.',
        hint: 'Use "docker volume create pgdata".',
        expectedCommand: 'docker volume create pgdata',
        explanation:
          'Named volumes persist data outside a container writable layer. Removing the container will not delete the volume.',
      },
      {
        instruction: 'Create an application bridge network.',
        hint: 'Use "docker network create appnet".',
        expectedCommand: 'docker network create appnet',
        explanation: 'User-defined bridge networks provide service-name DNS between containers.',
      },
      {
        instruction:
          'Run PostgreSQL on appnet using the pgdata volume and a password environment variable.',
        hint: 'Use "docker run -d --name db --network appnet -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=secret postgres:16-alpine".',
        expectedCommand: [
          'docker run -d --name db --network appnet -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=secret postgres:16-alpine',
          'docker container run -d --name db --network appnet -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=secret postgres:16-alpine',
        ],
        explanation:
          'This combines a persistent volume, a private network, and environment configuration: a realistic local database workflow.',
      },
      {
        instruction: 'List Docker networks to confirm appnet exists.',
        hint: 'Use "docker network ls".',
        expectedCommand: 'docker network ls',
        explanation:
          'Networks are first-class Docker objects. Naming them makes multi-container setups easier to reason about.',
      },
    ],
  },
  {
    id: 'compose',
    title: 'Compose Workflow',
    description: 'Use Docker Compose to manage a small app stack',
    icon: <Network className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Read the sample compose file.',
        hint: 'Use "cat compose.yaml".',
        expectedCommand: ['cat compose.yaml', 'cat docker-compose.yml'],
        explanation:
          'Compose describes a multi-container app declaratively: services, networks, volumes, ports, and environment.',
      },
      {
        instruction: 'Start the compose stack in the background.',
        hint: 'Use "docker compose up -d".',
        expectedCommand: ['docker compose up -d', 'docker-compose up -d'],
        explanation:
          'Compose creates the missing network, volume, and containers, then starts the stack as one unit.',
      },
      {
        instruction: 'Show the compose services and their state.',
        hint: 'Use "docker compose ps".',
        expectedCommand: ['docker compose ps', 'docker-compose ps'],
        explanation:
          'docker compose ps is the stack-level view, while docker ps is the daemon-level view.',
      },
      {
        instruction: 'Shut the compose stack down while keeping named volumes.',
        hint: 'Use "docker compose down".',
        expectedCommand: ['docker compose down', 'docker-compose down'],
        explanation:
          'Compose down removes the service containers and network. Named volumes stay unless you add --volumes.',
      },
    ],
  },
];

function normalizeImageRef(ref: string) {
  if (!ref.includes(':')) return `${ref}:latest`;
  return ref;
}

function imageName(image: DockerImage) {
  return `${image.repository}:${image.tag}`;
}

function cloneImage(image: DockerImage): DockerImage {
  return {
    ...image,
    layers: [...image.layers],
  };
}

function splitCommand(input: string): string[] {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ''));
}

function commandMatches(cmd: string, expected: string | string[]) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  const normalized = normalize(cmd);

  if (Array.isArray(expected)) {
    return expected.some((item) => normalize(item) === normalized);
  }

  return normalize(expected) === normalized;
}

function idFromName(name: string, salt: number) {
  const hex = Array.from(`${name}-${salt}`)
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString(16)
    .padStart(4, '0');
  return `${hex}${Math.random().toString(16).slice(2, 10)}`.slice(0, 12);
}

function formatImageTable(images: DockerImage[]) {
  const rows = images.map(
    (image) =>
      `${image.repository.padEnd(18)} ${image.tag.padEnd(12)} ${image.id.padEnd(14)} ${image.created.padEnd(14)} ${image.size}`
  );

  return ['REPOSITORY         TAG          IMAGE ID       CREATED        SIZE', ...rows].join('\n');
}

function formatContainerTable(containers: DockerContainer[], all = false) {
  const visible = all
    ? containers
    : containers.filter((container) => container.status === 'running');

  if (visible.length === 0) {
    return 'CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES';
  }

  const rows = visible.map((container) => {
    const status =
      container.status === 'running'
        ? `Up ${container.health ? `(${container.health})` : '2 minutes'}`
        : 'Exited (0) 1 minute ago';

    return `${container.id.slice(0, 12).padEnd(14)} ${container.image.padEnd(22)} ${container.command.padEnd(18)} ${container.created.padEnd(14)} ${status.padEnd(20)} ${(container.ports.join(', ') || '-').padEnd(18)} ${container.name}`;
  });

  return [
    'CONTAINER ID   IMAGE                  COMMAND            CREATED        STATUS               PORTS              NAMES',
    ...rows,
  ].join('\n');
}

function formatNetworks(networks: DockerNetwork[]) {
  return [
    'NETWORK ID     NAME      DRIVER    SCOPE',
    ...networks.map(
      (network, index) =>
        `${String(8_100 + index).padEnd(14)} ${network.name.padEnd(9)} ${network.driver.padEnd(9)} local`
    ),
  ].join('\n');
}

function formatVolumes(volumes: DockerVolume[]) {
  if (volumes.length === 0) return 'DRIVER    VOLUME NAME';
  return ['DRIVER    VOLUME NAME', ...volumes.map((volume) => `local     ${volume.name}`)].join(
    '\n'
  );
}

function statusColor(status: ContainerStatus) {
  if (status === 'running') return 'text-correct-foreground';
  if (status === 'created') return 'text-partial-foreground';
  return 'text-muted-foreground';
}

const AVAILABLE_COMMANDS = [
  'docker',
  'docker version',
  'docker info',
  'docker pull',
  'docker images',
  'docker ps',
  'docker run',
  'docker logs',
  'docker stop',
  'docker start',
  'docker exec',
  'docker inspect',
  'docker build',
  'docker history',
  'docker network',
  'docker volume',
  'docker compose',
  'cat Dockerfile',
  'cat compose.yaml',
  'clear',
  'help',
];

export default function DockerTerminalSimulator() {
  const [dockerState, setDockerState] = useState<DockerDaemonState>(createInitialState);
  const idCounter = useRef(1);

  const runningContainers = dockerState.containers.filter(
    (container) => container.status === 'running'
  );

  const findContainer = useCallback(
    (nameOrId: string) =>
      dockerState.containers.find(
        (container) => container.name === nameOrId || container.id.startsWith(nameOrId)
      ),
    [dockerState.containers]
  );

  const findImage = useCallback(
    (ref: string) => {
      const normalized = normalizeImageRef(ref);
      return dockerState.images.find((image) => imageName(image) === normalized);
    },
    [dockerState.images]
  );

  const pullImage = useCallback((ref: string) => {
    const normalized = normalizeImageRef(ref);
    const registryImage = REGISTRY_IMAGES[normalized];

    if (!registryImage) {
      return `Error response from daemon: manifest for ${normalized} not found: manifest unknown`;
    }

    setDockerState((prev) => {
      if (prev.images.some((image) => imageName(image) === normalized)) return prev;

      return {
        ...prev,
        images: [...prev.images, cloneImage(registryImage)],
      };
    });

    return `Using default tag: ${normalized.split(':')[1]}
${registryImage.id.slice(0, 12)}: Pull complete
Digest: sha256:${registryImage.id}${registryImage.id}
Status: Downloaded newer image for ${normalized}
docker.io/library/${normalized}`;
  }, []);

  const runContainer = useCallback(
    (args: string[]) => {
      let detached = false;
      let name = '';
      let network = 'bridge';
      const ports: string[] = [];
      const volumes: string[] = [];
      const env: Record<string, string> = {};
      const remaining: string[] = [];

      for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '-d' || arg === '--detach') {
          detached = true;
        } else if (arg === '--name') {
          name = args[i + 1] || '';
          i += 1;
        } else if (arg === '-p' || arg === '--publish') {
          const mapping = args[i + 1];
          if (mapping) ports.push(`${mapping}->tcp`);
          i += 1;
        } else if (arg === '--network' || arg === '--net') {
          network = args[i + 1] || 'bridge';
          i += 1;
        } else if (arg === '-v' || arg === '--volume') {
          const mapping = args[i + 1];
          if (mapping) volumes.push(mapping);
          i += 1;
        } else if (arg === '-e' || arg === '--env') {
          const pair = args[i + 1] || '';
          const [key, ...value] = pair.split('=');
          if (key) env[key] = value.join('=');
          i += 1;
        } else {
          remaining.push(arg);
        }
      }

      const imageRef = normalizeImageRef(remaining[0] || '');
      const command = remaining.slice(1).join(' ');

      if (!imageRef) return 'docker: "run" requires at least 1 argument.';

      let image = findImage(imageRef);
      let pullOutput = '';
      if (!image) {
        const registryImage = REGISTRY_IMAGES[imageRef];
        if (!registryImage) {
          return `Unable to find image '${imageRef}' locally
docker: Error response from daemon: pull access denied for ${imageRef}, repository does not exist or may require 'docker login'.`;
        }
        image = registryImage;
        pullOutput = `Unable to find image '${imageRef}' locally
${imageRef}: Pulling from library/${image.repository}
${image.id.slice(0, 12)}: Pull complete
Status: Downloaded newer image for ${imageRef}
`;
      }

      if (dockerState.containers.some((container) => container.name === name && name)) {
        return `docker: Error response from daemon: Conflict. The container name "/${name}" is already in use.`;
      }

      if (network && !dockerState.networks.some((item) => item.name === network)) {
        return `docker: Error response from daemon: network ${network} not found.`;
      }

      const containerName =
        name || `${image.repository.replace(/[^\w-]/g, '-')}-${idCounter.current}`;
      const id = idFromName(containerName, idCounter.current);
      idCounter.current += 1;

      const logs =
        image.repository === 'nginx'
          ? [
              '/docker-entrypoint.sh: Configuration complete; ready for start up',
              'nginx/1.27.0 started, listening on 0.0.0.0:80',
              'GET / HTTP/1.1 200 -',
            ]
          : image.repository === 'postgres'
            ? [
                'PostgreSQL Database directory appears to contain a database; Skipping initialization',
                'database system is ready to accept connections',
              ]
            : image.repository === 'redis'
              ? ['Ready to accept connections tcp-port=6379']
              : ['Application started on port 3000', 'GET /health 200 ok'];

      const container: DockerContainer = {
        id,
        name: containerName,
        image: imageRef,
        command:
          command || (image.repository === 'nginx' ? 'nginx -g daemon off;' : '/entrypoint.sh'),
        status: detached ? 'running' : 'exited',
        created: 'Less than a second ago',
        ports,
        env,
        network,
        volumes,
        logs,
        health: detached ? 'healthy' : undefined,
      };

      setDockerState((prev) => {
        const nextImages = prev.images.some((item) => imageName(item) === imageRef)
          ? prev.images
          : [...prev.images, cloneImage(image!)];

        const nextNetworks = prev.networks.map((item) =>
          item.name === network
            ? { ...item, containers: Array.from(new Set([...item.containers, containerName])) }
            : item
        );

        const nextVolumes = prev.volumes.map((volume) => ({
          ...volume,
          usedBy: [...volume.usedBy],
        }));
        for (const volumeMount of volumes) {
          const [volumeName] = volumeMount.split(':');
          const existing = nextVolumes.find((volume) => volume.name === volumeName);
          if (existing) {
            existing.usedBy = Array.from(new Set([...existing.usedBy, containerName]));
          } else if (volumeName && !volumeName.includes('/')) {
            nextVolumes.push({
              name: volumeName,
              mountpoint: `/var/lib/docker/volumes/${volumeName}/_data`,
              usedBy: [containerName],
            });
          }
        }

        return {
          ...prev,
          images: nextImages,
          containers: [...prev.containers, container],
          networks: nextNetworks,
          volumes: nextVolumes,
        };
      });

      return `${pullOutput}${detached ? id : logs.join('\n')}`;
    },
    [dockerState.containers, dockerState.networks, findImage]
  );

  const executeDockerCommand = useCallback(
    (args: string[]) => {
      let subcommand = args[0];
      let commandGroup = '';
      let rest = args.slice(1);

      if (subcommand === 'container' || subcommand === 'image') {
        commandGroup = subcommand;
        subcommand = rest[0];
        rest = rest.slice(1);
      }

      switch (subcommand) {
        case 'version':
          return `Client: Docker Engine - Community
 Version:           27.5.1
 API version:       1.47
 Go version:        go1.23.4

Server: Docker Engine - Community
 Engine:
  Version:          27.5.1
  Storage Driver:   overlay2
  Cgroup Driver:    systemd`;

        case 'info':
          return `Client: Docker Engine - Community
Server:
 Containers: ${dockerState.containers.length}
  Running: ${runningContainers.length}
  Paused: 0
  Stopped: ${dockerState.containers.length - runningContainers.length}
 Images: ${dockerState.images.length}
 Server Version: 27.5.1
 Storage Driver: overlay2
 Logging Driver: json-file
 Cgroup Driver: systemd
 Default Runtime: runc`;

        case 'images':
        case 'ls':
          if (commandGroup === 'container') {
            return formatContainerTable(
              dockerState.containers,
              rest.includes('-a') || rest.includes('--all')
            );
          }
          return formatImageTable(dockerState.images);

        case 'pull': {
          const ref = rest[0];
          if (!ref) return 'docker pull requires exactly 1 argument.';
          return pullImage(ref);
        }

        case 'ps':
          return formatContainerTable(
            dockerState.containers,
            rest.includes('-a') || rest.includes('--all')
          );

        case 'run':
          return runContainer(rest);

        case 'stop': {
          const target = rest[0];
          const container = target ? findContainer(target) : null;
          if (!target) return 'docker stop requires at least 1 argument.';
          if (!container) return `Error response from daemon: No such container: ${target}`;

          setDockerState((prev) => ({
            ...prev,
            containers: prev.containers.map((item) =>
              item.id === container.id ? { ...item, status: 'exited', health: undefined } : item
            ),
          }));
          return container.name;
        }

        case 'start': {
          const target = rest[0];
          const container = target ? findContainer(target) : null;
          if (!target) return 'docker start requires at least 1 argument.';
          if (!container) return `Error response from daemon: No such container: ${target}`;

          setDockerState((prev) => ({
            ...prev,
            containers: prev.containers.map((item) =>
              item.id === container.id ? { ...item, status: 'running', health: 'healthy' } : item
            ),
          }));
          return container.name;
        }

        case 'restart': {
          const target = rest[0];
          const container = target ? findContainer(target) : null;
          if (!target) return 'docker restart requires at least 1 argument.';
          if (!container) return `Error response from daemon: No such container: ${target}`;

          setDockerState((prev) => ({
            ...prev,
            containers: prev.containers.map((item) =>
              item.id === container.id ? { ...item, status: 'running', health: 'healthy' } : item
            ),
          }));
          return container.name;
        }

        case 'rm': {
          const force = rest.includes('-f') || rest.includes('--force');
          const target = rest.find((arg) => !arg.startsWith('-'));
          const container = target ? findContainer(target) : null;
          if (!target) return 'docker rm requires at least 1 argument.';
          if (!container) return `Error: No such container: ${target}`;
          if (container.status === 'running' && !force) {
            return `Error response from daemon: You cannot remove a running container ${container.id.slice(0, 12)}. Stop the container before attempting removal or force remove.`;
          }

          setDockerState((prev) => ({
            ...prev,
            containers: prev.containers.filter((item) => item.id !== container.id),
            networks: prev.networks.map((network) => ({
              ...network,
              containers: network.containers.filter((name) => name !== container.name),
            })),
            volumes: prev.volumes.map((volume) => ({
              ...volume,
              usedBy: volume.usedBy.filter((name) => name !== container.name),
            })),
          }));
          return container.name;
        }

        case 'logs': {
          const target = rest.find((arg) => !arg.startsWith('-'));
          const container = target ? findContainer(target) : null;
          if (!target) return 'docker logs requires exactly 1 argument.';
          if (!container) return `Error response from daemon: No such container: ${target}`;
          return container.logs.join('\n');
        }

        case 'exec': {
          const filtered = rest.filter((arg) => !['-it', '-i', '-t'].includes(arg));
          const target = filtered[0];
          const command = filtered.slice(1).join(' ');
          const container = target ? findContainer(target) : null;
          if (!target || !command) return 'docker exec requires a container and command.';
          if (!container) return `Error response from daemon: No such container: ${target}`;
          if (container.status !== 'running') {
            return `Error response from daemon: Container ${container.name} is not running`;
          }

          if (command === 'hostname') return container.id.slice(0, 12);
          if (command === 'printenv' || command === 'env') {
            return Object.entries({
              HOSTNAME: container.id.slice(0, 12),
              PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
              ...container.env,
            })
              .map(([key, value]) => `${key}=${value}`)
              .join('\n');
          }
          if (command === 'ls /') return 'bin\ndev\netc\nhome\nlib\nproc\ntmp\nusr\nvar';
          return `executed "${command}" in ${container.name}`;
        }

        case 'inspect': {
          const target = rest[0];
          const container = target ? findContainer(target) : null;
          if (!target) return 'docker inspect requires at least 1 argument.';
          if (!container) return `Error: No such object: ${target}`;

          return JSON.stringify(
            [
              {
                Id: container.id,
                Name: `/${container.name}`,
                Config: {
                  Image: container.image,
                  Env: Object.entries(container.env).map(([key, value]) => `${key}=${value}`),
                },
                State: {
                  Status: container.status,
                  Running: container.status === 'running',
                  Health: container.health ? { Status: container.health } : undefined,
                },
                NetworkSettings: {
                  Networks: {
                    [container.network]: {
                      NetworkID: `${container.network}-id`,
                      Aliases: [container.name],
                    },
                  },
                  Ports: container.ports,
                },
                Mounts: container.volumes,
              },
            ],
            null,
            2
          );
        }

        case 'build': {
          const tagIndex = rest.findIndex((arg) => arg === '-t' || arg === '--tag');
          const tag = tagIndex >= 0 ? rest[tagIndex + 1] : 'devops-api:latest';
          const context = rest[rest.length - 1];
          if (!context || context.startsWith('-')) return 'docker build requires a build context.';

          const image: DockerImage = {
            repository: tag.split(':')[0],
            tag: tag.split(':')[1] || 'latest',
            id: 'cafe42f00d11',
            created: 'Less than a second ago',
            size: '189MB',
            description: 'Sample Node.js API image built from the tutorial Dockerfile.',
            layers: [
              'FROM node:20-alpine',
              'WORKDIR /app',
              'COPY package.json .',
              'RUN npm ci --omit=dev',
              'COPY server.js .',
              'CMD node server.js',
            ],
          };

          setDockerState((prev) => ({
            ...prev,
            images: [...prev.images.filter((item) => imageName(item) !== imageName(image)), image],
          }));

          return `#1 [internal] load build definition from Dockerfile
#2 [internal] load metadata for docker.io/library/node:20-alpine
#3 [1/5] FROM docker.io/library/node:20-alpine
#4 [2/5] WORKDIR /app
#5 [3/5] COPY package.json .
#6 [4/5] RUN npm ci --omit=dev
#7 [5/5] COPY server.js .
#8 exporting to image
#8 naming to docker.io/library/${tag}
Successfully built ${image.id}
Successfully tagged ${tag}`;
        }

        case 'history': {
          const ref = rest[0];
          const image = ref ? findImage(ref) : null;
          if (!ref) return 'docker history requires exactly 1 argument.';
          if (!image) return `Error response from daemon: No such image: ${ref}`;
          return [
            'IMAGE          CREATED          CREATED BY                         SIZE',
            ...image.layers.map(
              (layer, index) =>
                `${image.id.slice(0, 12).padEnd(14)} ${`${index + 1} minutes ago`.padEnd(16)} ${layer.padEnd(34)} ${index === 0 ? image.size : '<missing>'}`
            ),
          ].join('\n');
        }

        case 'network': {
          const action = rest[0];
          if (action === 'ls') return formatNetworks(dockerState.networks);
          if (action === 'create') {
            const name = rest[1];
            if (!name) return 'docker network create requires exactly 1 argument.';
            if (dockerState.networks.some((network) => network.name === name)) return name;

            setDockerState((prev) => ({
              ...prev,
              networks: [...prev.networks, { name, driver: 'bridge', containers: [] }],
            }));
            return `${name}`;
          }
          return 'Usage: docker network [create|ls]';
        }

        case 'volume': {
          const action = rest[0];
          if (action === 'ls') return formatVolumes(dockerState.volumes);
          if (action === 'create') {
            const name = rest[1];
            if (!name) return 'docker volume create requires exactly 1 argument.';
            if (dockerState.volumes.some((volume) => volume.name === name)) return name;

            setDockerState((prev) => ({
              ...prev,
              volumes: [
                ...prev.volumes,
                {
                  name,
                  mountpoint: `/var/lib/docker/volumes/${name}/_data`,
                  usedBy: [],
                },
              ],
            }));
            return name;
          }
          return 'Usage: docker volume [create|ls]';
        }

        case 'system': {
          if (rest[0] === 'df') {
            return `TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          ${dockerState.images.length}         ${runningContainers.length}         682MB     138MB (20%)
Containers      ${dockerState.containers.length}         ${runningContainers.length}         24MB      12MB (50%)
Local Volumes   ${dockerState.volumes.length}         ${dockerState.volumes.filter((volume) => volume.usedBy.length > 0).length}         128MB     0B`;
          }
          return 'Usage: docker system df';
        }

        case 'compose':
          return executeComposeCommand(rest);

        default:
          return `docker: '${subcommand || ''}' is not a docker command.
See 'docker --help'.`;
      }
    },
    [
      dockerState,
      executeComposeCommand,
      findContainer,
      findImage,
      pullImage,
      runContainer,
      runningContainers.length,
    ]
  );

  function executeComposeCommand(args: string[]) {
    const action = args[0];

    if (action === 'up') {
      const detached = args.includes('-d') || args.includes('--detach');
      const apiExists = dockerState.containers.some(
        (container) => container.name === 'docker-sim-api-1'
      );
      const dbExists = dockerState.containers.some(
        (container) => container.name === 'docker-sim-db-1'
      );

      setDockerState((prev) => {
        const images = [...prev.images];
        for (const ref of ['devops-api:1.0', 'postgres:16-alpine']) {
          if (!images.some((image) => imageName(image) === ref)) {
            const registryImage = REGISTRY_IMAGES[ref];
            if (registryImage) images.push(cloneImage(registryImage));
          }
        }

        if (!images.some((image) => imageName(image) === 'devops-api:1.0')) {
          images.push({
            repository: 'devops-api',
            tag: '1.0',
            id: 'cafe42f00d11',
            created: 'Less than a second ago',
            size: '189MB',
            description: 'Sample Node.js API image built from the tutorial Dockerfile.',
            layers: ['FROM node:20-alpine', 'WORKDIR /app', 'COPY app', 'CMD node server.js'],
          });
        }

        const networks = prev.networks.some((network) => network.name === 'appnet')
          ? prev.networks
          : [...prev.networks, { name: 'appnet', driver: 'bridge' as const, containers: [] }];

        const volumes = prev.volumes.some((volume) => volume.name === 'pgdata')
          ? prev.volumes
          : [
              ...prev.volumes,
              {
                name: 'pgdata',
                mountpoint: '/var/lib/docker/volumes/pgdata/_data',
                usedBy: [],
              },
            ];

        const containers = [...prev.containers];
        if (!apiExists) {
          containers.push({
            id: idFromName('docker-sim-api-1', idCounter.current++),
            name: 'docker-sim-api-1',
            image: 'devops-api:1.0',
            command: 'node server.js',
            status: 'running',
            created: 'Less than a second ago',
            ports: ['3000:3000->tcp'],
            env: { NODE_ENV: 'production' },
            network: 'appnet',
            volumes: [],
            logs: ['api listening on :3000', 'connected to db:5432', 'GET /health 200 ok'],
            health: 'healthy',
          });
        }
        if (!dbExists) {
          containers.push({
            id: idFromName('docker-sim-db-1', idCounter.current++),
            name: 'docker-sim-db-1',
            image: 'postgres:16-alpine',
            command: 'docker-entrypoint.sh postgres',
            status: 'running',
            created: 'Less than a second ago',
            ports: ['5432/tcp'],
            env: { POSTGRES_PASSWORD: 'secret' },
            network: 'appnet',
            volumes: ['pgdata:/var/lib/postgresql/data'],
            logs: ['database system is ready to accept connections'],
            health: 'healthy',
          });
        }

        return {
          ...prev,
          images,
          containers,
          networks: networks.map((network) =>
            network.name === 'appnet'
              ? {
                  ...network,
                  containers: Array.from(
                    new Set([...network.containers, 'docker-sim-api-1', 'docker-sim-db-1'])
                  ),
                }
              : network
          ),
          volumes: volumes.map((volume) =>
            volume.name === 'pgdata'
              ? { ...volume, usedBy: Array.from(new Set([...volume.usedBy, 'docker-sim-db-1'])) }
              : volume
          ),
          composeRunning: true,
        };
      });

      return `${detached ? '' : '[+] Running 2/2\n'} Network docker-sim_appnet  Created
 Container docker-sim-db-1   Started
 Container docker-sim-api-1  Started`;
    }

    if (action === 'ps') {
      const composeContainers = dockerState.containers.filter((container) =>
        container.name.startsWith('docker-sim-')
      );
      if (composeContainers.length === 0) return 'NAME      IMAGE     SERVICE   STATUS    PORTS';
      return [
        'NAME                IMAGE                SERVICE   STATUS       PORTS',
        ...composeContainers.map(
          (container) =>
            `${container.name.padEnd(20)} ${container.image.padEnd(20)} ${container.name.includes('api') ? 'api'.padEnd(9) : 'db'.padEnd(9)} ${container.status.padEnd(12)} ${container.ports.join(', ') || '-'}`
        ),
      ].join('\n');
    }

    if (action === 'logs') {
      const target = args[1];
      const containers = dockerState.containers.filter((container) =>
        target
          ? container.name === `docker-sim-${target}-1` || container.name.includes(target)
          : container.name.startsWith('docker-sim-')
      );

      return containers
        .flatMap((container) => container.logs.map((line) => `${container.name}  | ${line}`))
        .join('\n');
    }

    if (action === 'down') {
      setDockerState((prev) => ({
        ...prev,
        containers: prev.containers.filter(
          (container) => !container.name.startsWith('docker-sim-')
        ),
        networks: prev.networks
          .filter((network) => network.name !== 'docker-sim_default')
          .map((network) =>
            network.name === 'appnet'
              ? {
                  ...network,
                  containers: network.containers.filter((name) => !name.startsWith('docker-sim-')),
                }
              : network
          ),
        volumes: prev.volumes.map((volume) => ({
          ...volume,
          usedBy: volume.usedBy.filter((name) => !name.startsWith('docker-sim-')),
        })),
        composeRunning: false,
      }));

      return `Container docker-sim-api-1  Removed
Container docker-sim-db-1   Removed
Network docker-sim_default  Removed`;
    }

    return 'Usage: docker compose [up|ps|logs|down]';
  }

  const executeCommand = useCallback(
    (cmd: string): ExecuteResult => {
      const trimmed = cmd.trim();
      const parts = splitCommand(trimmed);
      const command = parts[0];

      if (!command) return { output: '', type: 'output' };

      if (command === 'clear') {
        return { output: '', type: 'output', clear: true };
      }

      if (command === 'help') {
        return {
          type: 'output',
          output: `Available commands:
  docker version
  docker info
  docker pull IMAGE
  docker images
  docker ps [-a]
  docker run [options] IMAGE
  docker stop|start|restart CONTAINER
  docker logs CONTAINER
  docker exec CONTAINER COMMAND
  docker inspect CONTAINER
  docker build -t NAME:TAG .
  docker history IMAGE
  docker network create|ls
  docker volume create|ls
  docker compose up|ps|logs|down
  cat Dockerfile
  cat compose.yaml
  clear`,
        };
      }

      if (command === 'ls') {
        return { type: 'output', output: 'Dockerfile  compose.yaml  package.json  server.js' };
      }

      if (command === 'cat') {
        const target = parts[1];
        if (target === 'Dockerfile') return { type: 'output', output: SAMPLE_DOCKERFILE };
        if (target === 'compose.yaml' || target === 'docker-compose.yml') {
          return { type: 'output', output: SAMPLE_COMPOSE };
        }
        if (target === 'package.json') {
          return {
            type: 'output',
            output:
              '{\n  "scripts": { "start": "node server.js" },\n  "dependencies": { "fastify": "^5.0.0" }\n}',
          };
        }
        return { type: 'error', output: `cat: ${target || ''}: No such file or directory` };
      }

      if (command === 'docker-compose') {
        return { type: 'output', output: executeComposeCommand(parts.slice(1)) };
      }

      if (command === 'docker') {
        const output = executeDockerCommand(parts.slice(1));
        const type = output.includes('Error') || output.includes('not found') ? 'error' : 'output';
        return { output, type };
      }

      return { type: 'error', output: `${command}: command not found` };
    },
    [executeComposeCommand, executeDockerCommand]
  );

  const onReset = useCallback(() => {
    setDockerState(createInitialState());
    idCounter.current = 1;
  }, []);

  const lab = useTerminalSimulator({
    lessons: LESSONS,
    execute: executeCommand,
    matches: (cmd, command) => commandMatches(cmd, command.expectedCommand),
    successMessage: (command) => `OK: ${command.explanation}`,
    availableCommands: AVAILABLE_COMMANDS,
    onReset,
    // SimComplete signals Opsville, on the render that completes the last command.
    signalOnComplete: false,
    autoFocus: false,
  });
  const {
    currentCommand,
    terminalHistory,
    inputValue,
    setInputValue,
    inputRef,
    submitCommand,
    handleKeyDown,
  } = lab;
  const ui = useSimLab(lab);

  return (
    <SimFrame>
      <SimLabBar
        title="Docker Terminal Lab"
        icon={Container}
        lessons={LESSONS}
        lab={lab}
        ui={ui}
        task={currentCommand?.instruction}
        hint={currentCommand?.hint}
      />

      {ui.showComplete ? (
        <SimComplete
          title="Lab complete"
          summary="You pulled and ran images, debugged containers, built an image, wired up a network and a volume, and ran a Compose stack. You can run the lab again or keep experimenting."
          stats={labStats(lab, LESSONS, ui)}
          actions={
            <Button type="button" variant="outline" onClick={ui.keepExploring}>
              Keep exploring
            </Button>
          }
          onPlayAgain={ui.startOver}
          playAgainLabel="Start over"
        />
      ) : (
        <SimLabLayout
          terminal={
            <SimTerminal
              label="docker-lab ~/app"
              status={`${dockerState.images.length} images, ${runningContainers.length} running`}
              lines={labLines(terminalHistory, [
                { type: 'success', content: 'Welcome to Docker Terminal Lab.' },
                {
                  type: 'muted',
                  content: 'Type "help" for available commands, or follow the task above.',
                },
              ])}
              value={inputValue}
              onChange={setInputValue}
              onSubmit={submitCommand}
              onKeyDown={handleKeyDown}
              inputRef={inputRef}
              autoFocus
              heightClassName={LAB_TERMINAL_HEIGHT}
            />
          }
          aside={
            <>
              <SimLabPanel
                title="Docker daemon"
                icon={Server}
                summary={`${dockerState.containers.length} containers`}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Metric label="Images" value={dockerState.images.length} icon={<HardDrive />} />
                    <Metric label="Running" value={runningContainers.length} icon={<Play />} />
                    <Metric
                      label="Networks"
                      value={dockerState.networks.length}
                      icon={<Network />}
                    />
                    <Metric
                      label="Volumes"
                      value={dockerState.volumes.length}
                      icon={<Database />}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Engine <span className="font-mono">overlay2</span>. Containers share the host
                    kernel, isolate processes with namespaces, and persist mutable data through
                    volumes.
                  </p>

                  <StateHeading>Containers</StateHeading>
                  {dockerState.containers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No containers yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {dockerState.containers.map((container) => (
                        <li key={container.id} className="rounded-md border p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{container.name}</div>
                              <div className="truncate font-mono text-xs text-muted-foreground">
                                {container.image}
                              </div>
                            </div>
                            <Badge
                              variant={container.status === 'running' ? 'default' : 'secondary'}
                              className="capitalize"
                            >
                              {container.status}
                            </Badge>
                          </div>
                          <div className="mt-1.5 grid gap-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              {container.status === 'running' ? (
                                <Play
                                  className={cn('h-3.5 w-3.5', statusColor(container.status))}
                                  aria-hidden="true"
                                />
                              ) : (
                                <Square
                                  className={cn('h-3.5 w-3.5', statusColor(container.status))}
                                  aria-hidden="true"
                                />
                              )}
                              {container.ports.length
                                ? container.ports.join(', ')
                                : 'no published ports'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Network className="h-3.5 w-3.5" aria-hidden="true" />
                              {container.network}
                            </div>
                            {container.volumes.length > 0 && (
                              <div className="flex items-center gap-2">
                                <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                                {container.volumes.join(', ')}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <StateHeading>Images</StateHeading>
                  <ul className="space-y-1.5">
                    {dockerState.images.map((image) => (
                      <li key={imageName(image)} className="rounded-md border p-2">
                        <div className="flex items-center justify-between gap-3">
                          <code className="font-mono text-sm font-semibold">
                            {imageName(image)}
                          </code>
                          <span className="text-xs text-muted-foreground">{image.size}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{image.description}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {image.layers.slice(0, 4).map((layer) => (
                            <span
                              key={layer}
                              className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              {layer}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <StateHeading>Networks and volumes</StateHeading>
                  <ul className="space-y-1.5">
                    {dockerState.networks.map((network) => (
                      <li
                        key={network.name}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <span>{network.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {network.driver}, {network.containers.length} attached
                        </span>
                      </li>
                    ))}
                    {dockerState.volumes.length === 0 ? (
                      <li className="text-sm text-muted-foreground">No named volumes yet.</li>
                    ) : (
                      dockerState.volumes.map((volume) => (
                        <li
                          key={volume.name}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                        >
                          <span>{volume.name}</span>
                          <span className="text-xs text-muted-foreground">
                            used by {volume.usedBy.length}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </SimLabPanel>
              <SimLabPanel title="Lessons" icon={BookOpen} summary={lessonsSummary(LESSONS, lab)}>
                <SimLabLessons lessons={LESSONS} lab={lab} ui={ui} />
              </SimLabPanel>
              <SimLabPanel title="Quick reference" icon={ListChecks}>
                <dl className="grid gap-1.5 text-sm">
                  {QUICK_REFERENCE.map(([command, label]) => (
                    <div key={command} className="rounded-md bg-muted/50 px-2 py-1.5">
                      <dt className="font-mono text-xs font-semibold">{command}</dt>
                      <dd className="text-xs text-muted-foreground">{label}</dd>
                    </div>
                  ))}
                </dl>
              </SimLabPanel>
            </>
          }
        />
      )}
    </SimFrame>
  );
}

const QUICK_REFERENCE = [
  ['docker ps', 'Running containers'],
  ['docker logs web', 'Read stdout/stderr'],
  ['docker exec web sh', 'Run inside a container'],
  ['docker compose up -d', 'Start a stack'],
];

function StateHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactElement<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <div className="flex items-center justify-between">
        {React.cloneElement(icon, {
          className: 'h-4 w-4 text-primary',
          strokeWidth: 1.5,
          'aria-hidden': true,
        })}
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
