
# zwavejs2mqtt-docker

[![dockeri.co](https://dockeri.co/image/zwavejs/zwavejs2mqtt)](https://hub.docker.com/r/zwavejs/zwavejs2mqtt)

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/MVg9wc2HE 'Buy Me A Coffee')

Docker container for zwavejs2mqtt Gateway and Control Panel

## Architectures

Supported architectures are:

- `x86_64 amd64`
- `armv6`
- `armv7` (Ex. Raspberry PI)
- `arm64` (Ex. OrangePI NanoPI)

## Tags

Supported tags are:

- `latest` for the latest official release.
- `master` newest version, image gets built after every new commit to the master branch in the [zwavejs2mqtt](https://github.com/zwave-js/zwavejs2mqtt/commits/master) repository. (not recommended for the average user)
- `sha-<commit-sha>` (example: `sha-92d502a`)
- `<version>` (example: `2.1.0`)

Note: `dev` tag have been deprecated.

## Install

There are three different way to start the container and provide data persistence. For all of the methods **remember to**:

1. Replace `/dev/ttyACM0` with your serial device
2. Add `-e TZ=Europe/Stockholm` (or your timezone) to the `docker run` command to set the correct timezone in container
3. If you are using zwave-js WS server and you chance the default WS port, replace `3000:3000` with the port chosen in settings

### Run using volumes

```bash
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/ttyACM0 --mount source=zwavejs2mqtt,target=/usr/src/app/store zwavejs/zwavejs2mqtt:latest
```

### Run using local folder

Here we will store our data in the current path (`$(pwd)`) named `store`. You can choose the path and the directory name you prefer, a valid alternative (with linux) could be `/var/lib/zwavejs2mqtt`

```bash
mkdir store
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/ttyACM0 -v $(pwd)/store:/usr/src/app/store zwavejs/zwavejs2mqtt:latest
```

### Run as a service

To run the app as a service you can use the `docker-compose.yml` file you find [here](./docker-compose.yml). Here is the content:

```yml
version: "3.7"
services:
  zwavejs2mqtt:
    container_name: zwavejs2mqtt
    image: zwavejs/zwavejs2mqtt:latest
    restart: always
    tty: true
    stop_signal: SIGINT
    environment:
      - SESSION_SECRET=mysupersecretkey
    # - TZ=America/Los_Angeles  # uncomment and edit to match you timezone if you want logs time and dates to match your timezone instead of UTC.
    networks:
      - zwave
    devices:
      - "/dev/ttyACM0:/dev/ttyACM0"
    volumes:
      - ./store:/usr/src/app/store
    ports:
      - "8091:8091" # port for web interface
      - "3000:3000" # port for zwave-js websocket server
networks:
  zwave:
volumes:
  zwave-config:
    name: zwave-config
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

# Custom builds

There are two methods to build a custom docker container, using either the project's Dockerfile or Dockerfile.contrib. While the Dockerfile method offers a faster build process, the alternative Dockerfile.contrib method allows you to specify the specific branches for node-zwave-js and zwavejs2mqtt, and even the ability to specify alternative repositories (such as your own).

## Building a container using Dockerfile

The docker images are the latest stable images of the [zwavejs2mqtt](https://github.com/zwave-js/zwavejs2mqtt) repo. If you want to keep your image updated with the latest changes you can build it on your local machine. For example:

```bash
git clone https://github.com/zwave-js/zwavejs2mqtt.git
cd zwavejs2mqtt
git checkout -b [the branch that you want]
docker build -f docker/Dockerfile -t zwavejs/zwavejs2mqtt:latest .
```

Build just the `build` container

```bash
docker build -f docker/Dockerfile --target=build -t zwavejs/zwavejs2mqtt_build .

```

## Building a container using Dockerfile.contrib

You can also build a custom docker image using any mix of branches or repositories (such as your own), simply run the following series of commands, indicating the name of the branches you wish to build for node-zwave-js (ZWJ_BRANCH) and zwavejs2mqtt (Z2M_BRANCH) and the resulting docker image name (e.g. zwavejs2mqtt):

```bash
curl -s https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/docker/Dockerfile.contrib | \
DOCKER_BUILDKIT=1 docker build - --build-arg SRC=git-clone-src --no-cache \
--build-arg ZWJ_BRANCH=master --build-arg Z2M_BRANCH=master -t zwavejs2mqtt
```

Alternatively, you can clone the branches locally, make any changes you like, and build a docker image from the local sources:

```bash
mkdir -p testing && cd testing
git clone https://github.com/zwave-js/node-zwave-js
git clone https://github.com/zwave-js/zwavejs2mqtt
## Checkout repos to any branch/commit you need to test
cd ../node-zwave-js
git checkout <branch, sha or tag>
cd zwavejs2mqtt
git checkout <branch, sha or tag>
cd ..
```

Then when you're ready to build run the following from the directory *above* the zwavejs2mqtt folder (the "testing" folder from above):

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

> [!NOTE] You may optionally specify alternative repositories (such as your own) by appending

`--build-arg ZWJ_REPOSITORY=https://github.com/FakeUser/node-zwave-js` or

`--build-arg Z2M_REPOSITORY=https://github.com/FakeUser/zwavejs2mqtt`

> [!NOTE] Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
