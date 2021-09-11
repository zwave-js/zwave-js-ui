
# Using Docker

## Supported Archs

Supported architectures are:

- `x86_64 amd64`
- `armv6`
- `armv7` (Ex. Raspberry PI)
- `arm64` (Ex. OrangePI NanoPI)

> [!NOTE] If you get the error `standard_init_linux.go:207: exec user process caused "exec format error"`, you most likely installed the wrong package intended for a [different architecture](https://github.com/zwave-js/zwavejs2mqtt/tree/master/docs/troubleshooting/improper-arch.md).

## Available Tags

Available tags are:

- `latest` for the latest official release.
- `master` newest version, image gets built after every new commit to the master branch in the [zwavejs2mqtt](https://github.com/zwave-js/zwavejs2mqtt/commits/master) repository. (not recommended for the average user)
- `sha-<commit-sha>` (example: `sha-92d502a`)
- `<version>` (example: `2.1.0`)

## Installation

There are three different way to start the container and provide data persistence. For all of the methods **remember to**:

1. Configure the path for your serial device
2. Add your timezone (e.g. `-e TZ=Europe/Stockholm` or `-e TZ=America/New_York`) to the `docker run` command to set the correct timezone in the container.
    - Time zone codes can be found at: <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones>.
3. If you are using the Z-Wave JS web socket server (for the official Home Assistant integration) **and you change the default port**, replace `3000:3000` with the port chosen in settings

> [!WARNING]
> - Do not use /dev/ttyUSBX serial devices, as those mappings can change over time.
> - Instead, use the /dev/serial/by-id/X serial device for your Z-Wave stick.

### Run using volumes

```bash
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/serial/by-id/insert_stick_reference_here:/dev/zwave \
--mount source=zwavejs2mqtt,target=/usr/src/app/store zwavejs/zwavejs2mqtt:latest
```

> [!NOTE]
> Replace `/dev/serial/by-id/insert_stick_reference_here` with the serial device for your Z-Wave stick.

### Run using a local folder

In this example we will store our data in the current path (`$(pwd)`) named `store`. You can choose the path and the directory name you prefer on the docker host.

```bash
mkdir store
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/serial/by-id/insert_stick_reference_here:/dev/zwave \
-v $(pwd)/store:/usr/src/app/store zwavejs/zwavejs2mqtt:latest
```

> [!NOTE]
> Replace `/dev/serial/by-id/insert_stick_reference_here` with the serial device for your Z-Wave stick.

### Run as a service

To run ZWavejs2Mqtt as a service you can use the `docker-compose.yml` found [here](./docker-compose.yml):

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
      # Uncomment if you want log times and dates to match your timezone instead of UTC
      # Available at https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
      #- TZ=America/New_York
    networks:
      - zwave
    devices:
      # Do not use /dev/ttyUSBX serial devices, as those mappings can change over time.
      # Instead, use the /dev/serial/by-id/X serial device for your Z-Wave stick.
      - '/dev/serial/by-id/insert_stick_reference_here:/dev/zwave'
    volumes:
      - ./store:/usr/src/app/store
    ports:
      - "8091:8091" # port for web interface
      - "3000:3000" # port for Z-Wave JS websocket server
networks:
  zwave:
volumes:
  zwave-config:
    name: zwave-config
```

> [!NOTE]
> Like the other methods replace `/dev/serial/by-id/insert_stick_reference_here` with the serial device for your Z-Wave stick.

# Custom Docker Builds

There are two methods to build a custom docker container, using either the project's Dockerfile or Dockerfile.contrib. While the Dockerfile method offers a faster build process, the alternative Dockerfile.contrib method allows you to specify the specific branches for node-zwave-js and ZWavejs2Mqtt, and even the ability to specify alternative repositories (such as your own).

## Building a container using Dockerfile

The docker images are the latest stable images of the [ZWavejs2Mqtt](https://github.com/zwave-js/zwavejs2mqtt) repo. If you want to keep your image updated with the latest changes you can build it on your local machine. For example:

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

You can also build a custom docker image using any mix of branches or repositories (such as your own), simply run the following series of commands, indicating the name of the branches you wish to build for node-zwave-js (ZWJ_BRANCH) and ZWavejs2Mqtt (Z2M_BRANCH) and the resulting docker image name (e.g. zwavejs2mqtt):

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

Then when you're ready to build run the following from the directory **above** the ZWavejs2Mqtt folder (the "testing" folder from above):

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

> [!NOTE] You may optionally specify alternative repositories (such as your own) by appending
>
>`--build-arg ZWJ_REPOSITORY=https://github.com/FakeUser/node-zwave-js` or
>
>`--build-arg Z2M_REPOSITORY=https://github.com/FakeUser/zwavejs2mqtt`

> [!NOTE] Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
