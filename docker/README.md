# Zwave2Mqtt-docker

[![dockeri.co](https://dockeri.co/image/robertslando/zwave2mqtt)](https://hub.docker.com/r/robertslando/zwave2mqtt)

<a href="https://www.buymeacoffee.com/MVg9wc2HE" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

Docker container for Zwave2Mqtt Gateway and Control Panel app using pkg

**ATTENTION: STARTING FROM Z2M 2.1.1 OZW 1.4 SUPPORT HAS ENDED AND `latest` TAG WILL ALWAYS HAVE OZW 1.6**

## Tags

Supported architectures are:

- `x86_64 amd64`
- `armv6`
- `armv7` (Ex. Raspberry PI)
- `arm64` (Ex. OrangePI NanoPI)

**Available Tags**:

- `latest`: Always points to the latest stable version published (using OZW 1.6)
- `dev`:  Always point to latest OZW and Zwave2Mqtt master branches
- `3.1.0`: OZW 1.6.1115
- `3.0.4`: OZW 1.6.1115
- `3.0.3`: OZW 1.6.1080
- `3.0.2`: OZW 1.6.1061
- `3.0.1`: OZW 1.6.1045
- `3.0.0`: OZW 1.6.1045
- `2.2.0`: OZW 1.6.1038
- `2.1.1`: OZW 1.6.1004
- `2.1.0`: OZW 1.4
- `2.1.0-dev`: OZW 1.6.1004
- `2.0.6`: OZW 1.4
- `2.0.6-dev`: OZW 1.6.962

**DEPRECATED**:

- `latest-dev`: Starting from version 2.1.1 OZW 1.4 is no more supported so `latest` tag will always contain OZW 1.6. Last available `latest-dev` manifest is running z2m 2.1.0 with ozw 1.6

## Install

Here there are 3 different way to start the container and provide data persistence. In all of this solutions **remember to**:

1. Replace `/dev/ttyACM0` with your serial device
2. Add `-e TZ=Europe/Stockholm` to the `docker run` command to set the correct timezone in container

### Run using volumes

```bash
docker run --rm -it -p 8091:8091 --device=/dev/ttyACM0 --mount source=zwave2mqtt,target=/usr/src/app/store robertslando/zwave2mqtt:latest
```

### Run using local folder

Here we will store our data in the current path (`$(pwd)`) named `store`. You can choose the path and the directory name you prefer, a valid alternative (with linux) could be `/var/lib/zwave2mqtt`

```bash
mkdir store
docker run --rm -it -p 8091:8091 --device=/dev/ttyACM0 -v $(pwd)/store:/usr/src/app/store robertslando/zwave2mqtt:latest
```

### Run as a service

To run the app as a service you can use the `docker-compose.yml` file you find [here](./docker-compose.yml). Here is the content:

```yml
version: "3.7"
services:
  zwave2mqtt:
    container_name: zwave2mqtt
    image: robertslando/zwave2mqtt:latest
    restart: always
    tty: true
    stop_signal: SIGINT
    networks:
      - zwave
    devices:
      - "/dev/ttyACM0:/dev/ttyACM0"
    volumes:
      - ./store:/usr/src/app/store
    ports:
      - "8091:8091"
networks:
  zwave:
# volumes:
#   zwave2mqtt:
#     name: zwave2mqtt
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
        image: robertslando/zwave2mqtt:latest
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
      #     secretName: zwave2mqtt
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

### Upgrade from 1.0.0 to 1.1.0

In 1.0.0 version all application data where stored inside the volume. This could cause many problems expectially when upgrading. To prevent this, starting from version 1.1.0 all persistence data have been moved to application `store` folder. If you have all your data stored inside a volume `zwave2mqtt` this is how to backup them:

```bash
APP=$(docker run --rm -it -d --mount source=zwave2mqtt,target=/usr/src/app robertslando/zwave2mqtt:latest)
docker cp $APP:/usr/src/app ./
docker kill $APP
```

This will create a directory `app` with all app data inside. Move all files like `OZW_log.txt zwscene.xml zwcfg_<homehex>.xml` in `app/store` folder and use that folder as volume following [this](#run-using-local-folder) section

### ATTENTION

If you get the error `standard_init_linux.go:207: exec user process caused "exec format error"` probably it's because you previously installed a wrong architecture version of the package so in that case you must delete the existing volume that contains the old executable:

`docker volume rm zwave2mqtt`

Check files inside volume

```bash
docker run --rm -it --mount source=zwave2mqtt,target=/usr/src/app robertslando/zwave2mqtt:latest find /usr/src/app
```

Delete Volume

```bash
docker volume rm zwave2mqtt
```

### Auto Update OZW device database

If you would like to enable this feature of OZW you need to keep the device database inside a volume or a local folder and map it inside the container. To do this follow this steps:

```sh
APP=$(docker run --rm -it -d robertslando/zwave2mqtt:latest)
docker cp $APP:/usr/local/etc/openzwave ./
docker kill $APP
```

With this command you should have copied all your container device db in a local folder named `openzwave`. Now you should map this folder inside your container:

By adding an option:

`-v $(pwd)/openzwave:/usr/local/etc/openzwave`

Or in docker-compose file:

```yml
volumes:
      - ./openzwave:/usr/local/etc/openzwave
```

## Custom builds

The docker images are the latest stable images of the [zwave2mqtt](https://github.com/OpenZWave/Zwave2Mqtt) repo. If you want to keep your image updated with the latest changes you can build it on your local machine. Just select a commit sha, a branch name, or a tag name, and pass it to docker build using the *--build-arg* option for the *Z2M_GIT_SHA1* and *OPENZWAVE_GIT_SHA1* arguments. For example:

```bash
git clone https://github.com/OpenZWave/Zwave2Mqtt.git
cd Zwave2Mqtt/docker
docker build --build-arg Z2M_GIT_SHA1=master --build-arg OPENZWAVE_GIT_SHA1=master -t robertslando/zwave2mqtt:latest .
```

Build just the `build` container

```bash
docker build --target=build -t robertslando/zwave2mqtt_build .

```

## SSH inside container

```bash
docker run --rm -p 8091:8091 --device=/dev/ttyACM0 -it --mount source=zwave2mqtt,target=/usr/src/app robertslando/zwave2mqtt:latest sh
```

```bash
docker run --rm -p 8091:8091 --device=/dev/ttyACM0 -it --mount source=zwave2mqtt,target=/dist/pkg robertslando/zwave2mqtt_build sh
```
