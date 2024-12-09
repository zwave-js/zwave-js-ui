# Using Docker

> [!TIP]
> Building your own docker image is [easy!](development/custom-docker.md). This allows you to change the arch and/or use any combination of node-zwave-js/zwave-js-ui branches.

## Supported Archs

Supported architectures are:

- `x86_64 amd64`
- `armv6`
- `armv7` (Ex. Raspberry PI)
- `arm64` (Ex. OrangePI NanoPI)

> [!NOTE] If you get the error `standard_init_linux.go:207: exec user process caused "exec format error"`, you most likely installed the wrong package intended for a [different architecture](https://github.com/zwave-js/zwave-js-ui/tree/master/docs/troubleshooting/improper-arch.md).

## Available Tags

Available tags are:

- `latest` for the latest official release.
- `master` for the bleeding-edge version. This image is built after every new commit to the master branch in the [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui/commits/master) repository. Use at your own caution.
- `sha-<commit-sha>` (example: `sha-92d502a`)
- _Version tags:_ We provide multiple ones with different specificity in the [semantic versioning](https://semver.org/):
  - `<major>`: latest release **within the same major**, example: `8` will update for any v8.\* but will not update for v9.0.0.
  - `<major>.<minor>`: latest release **within the same minor**, example: `8.2` will update for any v8.2.1, v8.2.2 and v8.2.9; but not for v8.3.0.
  - `<major>.<minor>.<patch>`: static pointer to a specific release, example `8.2.1`.

## Installation

There are three different way to start the container and provide data persistence. For all of the methods **remember to**:

1. Configure the path for your serial device
2. Add your timezone (e.g. `-e TZ=Europe/Stockholm` or `-e TZ=America/New_York`) to the `docker run` command to set the correct timezone in the container.
    - Time zone codes can be found at: <https://en.wikipedia.org/wiki/List_of_tz_database_time_zones>.
3. If you are using the Z-Wave JS web socket server (for the official Home Assistant integration) **and you change the default port**, replace `3000:3000` with the port chosen in settings

> [!WARNING]
>
> - Do not use /dev/ttyUSBX serial devices, as those mappings can change over time.
> - Instead, use the /dev/serial/by-id/X serial device for your Z-Wave stick.

### Run using volumes

```bash
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/serial/by-id/insert_stick_reference_here:/dev/zwave \
--mount source=zwave-js-ui,target=/usr/src/app/store zwavejs/zwave-js-ui:latest
```

> [!NOTE]
> Replace `/dev/serial/by-id/insert_stick_reference_here` with the serial device for your Z-Wave stick.

### Run using a local folder

In this example we will store our data in the current path (`$(pwd)`) named `store`. You can choose the path and the directory name you prefer on the docker host.

```bash
mkdir store
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/serial/by-id/insert_stick_reference_here:/dev/zwave \
-v $(pwd)/store:/usr/src/app/store zwavejs/zwave-js-ui:latest
```

> [!NOTE]
> Replace `/dev/serial/by-id/insert_stick_reference_here` with the serial device for your Z-Wave stick.

### Run as a service

To run Z-Wave JS UI as a service you can use the `docker-compose.yml` found [here](https://github.com/zwave-js/zwave-js-ui/blob/master/docker/docker-compose.yml):

```yml
version: '3.7'
services:
    zwave-js-ui:
        container_name: zwave-js-ui
        image: zwavejs/zwave-js-ui:latest
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
            - zwave-config:/usr/src/app/store
        # Or by using local folder
        # - ./store:/usr/src/app/store
        ports:
            - '8091:8091' # port for web interface
            - '3000:3000' # port for Z-Wave JS websocket server
networks:
    zwave:
volumes:
    zwave-config:
        name: zwave-config
```

> [!NOTE]
> Like the other methods replace `/dev/serial/by-id/insert_stick_reference_here` with the serial device for your Z-Wave stick.

> [!NOTE]
> You may choose to limit websocket connections to only those coming from localhost for security reasons, though doing so may require you to alter your integration's configuration to use the localhost IP. To do so, change the port mapping to "127.0.0.1:3000:3000"

### Healthcheck

In order to add an healthcheck to your container you can use this command:

```bash
wget --no-verbose --spider --no-check-certificate --header "Accept: text/plain" https://localhost:8091/health || exit 1
```

Remember to change `https` with `http` if you didn't enable HTTPS in settings.

Docker compose:

```yml
version: '3.7'
services:
    zwave-js-ui:
    # ..... other settings .....
      healthcheck:
          test: 'wget --no-verbose --spider --no-check-certificate --header "Accept: text/plain" https://localhost:8091/health || exit 1'
          interval: 1m
          timeout: 10s
          start_period: 30s
          retries: 3
```

Docker:

```bash
docker run <other options here> --health-cmd="wget --no-verbose --spider --no-check-certificate --header "Accept: text/plain" https://localhost:8091/health || exit 1" --health-start-period=30s
```
