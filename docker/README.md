
# zwavejs2mqtt-docker

[![dockeri.co](https://dockeri.co/image/zwavejs/zwavejs2mqtt)](https://hub.docker.com/r/zwavejs/zwavejs2mqtt)

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/MVg9wc2HE 'Buy Me A Coffee')

Docker container for zwavejs2mqtt Gateway and Control Panel

## Tags

Supported architectures are:

- `x86_64 amd64`
- `armv6`
- `armv7` (Ex. Raspberry PI)
- `arm64` (Ex. OrangePI NanoPI)

## Install

Here there are 3 different way to start the container and provide data persistence. In all of this solutions **remember to**:

1. Replace `/dev/ttyACM0` with your serial device
2. Add `-e TZ=Europe/Stockholm` to the `docker run` command to set the correct timezone in container
3. Replace `3000:3000` with the Server Port of  the websocket

### Run using volumes

```bash
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/ttyACM0 --mount source=zwavejs2mqtt,target=/usr/src/app/store zwavejs/zwavejs2mqtt:latest
```

### Run using local folder

Here we will store our data in the current path (`$(pwd)`) named `store`. You can choose the path and the directory name you prefer, a valid alternative (with linux) could be `/var/lib/zwavejs2mqtt`

```bash
mkdir store
docker run --rm -it -p 8091:8091 p3000:3000 --device=/dev/ttyACM0 -v $(pwd)/store:/usr/src/app/store zwavejs/zwavejs2mqtt:latest
```

### Run as a service

To run the app as a service you can use the `docker-compose.yml` file you find [here](./docker-compose.yml). Here is the content:

```yml
version: '3.7'
services:
  zwavejs2mqtt:
    container_name: zwavejs2mqtt
    image: zwavejs/zwavejs2mqtt:latest
    restart: always
    tty: true
    stop_signal: SIGINT
    networks:
      - zwave
    devices:
      - '/dev/ttyACM0:/dev/ttyACM0'
    volumes:
      - ./store:/usr/src/app/store
    ports:
      - '8091:8091'
      - '3000:3000'
networks:
  zwave:
# volumes:
#   zwavejs2mqtt:
#     name: zwavejs2mqtt
```

Like the other solutions, remember to replace device `/dev/ttyACM0` with the path of your USB stick and choose the solution you prefer for data persistence.

### Run as a kubernetes deployment

```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zwave
spec:
  replicas: 1
  selector:
    matchLabels:
      name: zwave
  template:
    metadata:
      labels:
        name: zwave
    spec:
      containers:
      - name: zwave
        image: zwavejs/zwavejs2mqtt:latest
        livenessProbe:
          failureThreshold: 10
          httpGet:
            httpHeaders:
            - name: Accept
              value: text/plain
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 3
          successThreshold: 1
          timeoutSeconds: 1
        ports:
        - containerPort: 8091
          name: http
          protocol: TCP
        resources:
          limits:
            cpu: "1"
            memory: 512Mi
          requests:
            cpu: "1"
            memory: 400Mi
        securityContext:
          allowPrivilegeEscalation: true
          privileged: true
        volumeMounts:
        - mountPath: /dev/ttyUSB1
          name: zwavestick
        - mountPath: /usr/src/app/store
          name: data
        # - mountPath: /usr/src/app/store/settings.json <-- if putting your settings.json in a secret
        #   name: config
        #   readOnly: true
        #   subPath: settings.json
      nodeSelector:
        kubernetes.io/hostname: stick1 #<--- the name of your cluster node that the zwave usb stick in
      volumes:
      # - name: config <-- if putting your settings.json in a secret
      #   secret:
      #     defaultMode: 420
      #     secretName: zwavejs2mqtt
      - name: zwavestick
        hostPath:
          path: /dev/ttyACM0
          type: File
      - name: data
          hostPath:
            path: /zwave/data
---
apiVersion: v1
kind: Service
metadata:
  name: zwave
spec:
  ports:
  - name: http
    port: 80
    targetPort: http
  selector:
    name: zwave
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: zwave
spec:
  rules:
  - host: zwave.example.com
    http:
      paths:
      - backend:
          serviceName: zwave
          servicePort: http
```

Like the other solutions, remember to replace device `/dev/ttyACM0` with the path of your USB stick and choose the solution you prefer for data persistence.

### ATTENTION

If you get the error `standard_init_linux.go:207: exec user process caused "exec format error"` probably it's because you previously installed a wrong architecture version of the package so in that case you must delete the existing volume that contains the old executable:

`docker volume rm zwavejs2mqtt`

Check files inside volume

```bash
docker run --rm -it --mount source=zwavejs2mqtt,target=/usr/src/app zwavejs/zwavejs2mqtt:latest find /usr/src/app
```

Delete Volume

```bash
docker volume rm zwavejs2mqtt
```

## Custom builds

The docker images are the latest stable images of the [zwavejs2mqtt](https://github.com/zwave-js/zwavejs2mqtt) repo. If you want to keep your image updated with the latest changes you can build it on your local machine. Just select a commit sha, a branch name, or a tag name, and pass it to docker build using the _--build-arg_ option for the _Z2M_GIT_SHA1_ argument. For example:

```bash
git clone https://github.com/zwave-js/zwavejs2mqtt.git
cd zwavejs2mqtt
docker build -f docker/Dockerfile --build-arg Z2M_GIT_SHA1=master -t zwavejs/zwavejs2mqtt:latest .
```

Build just the `build` container

```bash
docker build -f docker/Dockerfile --target=build -t zwavejs/zwavejs2mqtt_build .

```

## SSH inside container

```bash
docker run --rm -p 8091:8091 --device=/dev/ttyACM0 -it --mount source=zwavejs2mqtt,target=/usr/src/app zwavejs/zwavejs2mqtt:latest sh
```

```bash
docker run --rm -p 8091:8091 --device=/dev/ttyACM0 -it --mount source=zwavejs2mqtt,target=/dist/pkg zwavejs/zwavejs2mqtt_build sh
```

## Building a container using Dockerfile.contrib

This is typically used to build zwavejs2mqtt from git with a version of zwave-js also from git, for instance the latest master or a branch.

### Prerequisites

In order to build it you first need the source code from github.

```bash
mkdir -p testing && cd testing
git clone https://github.com/zwave-js/node-zwave-js
git clone https://github.com/zwave-js/zwavejs2mqtt
## Checkout repos to any branch/commit you need to test
```

### Build

The run the build from outside the two repo folders.

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=git-clone-src --build-arg Z2M_BRANCH=master --build-arg ZWJ_BRANCH=master --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

or

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

> :star: **Note**: Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
