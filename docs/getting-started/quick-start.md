# Quick start

Zwavejs2Mqtt can be run in several different ways. Choose the one that best fits your needs.

After running ZWavejs2Mqtt using one of the below methods, you can access it in your web browser at <http://localhost:8091> on the machine on which it was run, or at the IP address of your remote installation on port 8091.

**You must edit the [settings](usage/setup.md) before ZWavejs2Mqtt will become functional.**

If you are using Home Assistant, the UI can be added to Lovelace so that it can be accessed from within Home Assistant using the [following instructions](homeassistant/accessing-lovelace.md).

## Docker

The easiest way to run Zwavejs2Mqtt is by using docker:

```bash
# Using volumes as persistence
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/ttyACM0 --mount source=zwavejs2mqtt,target=/usr/src/app/store zwavejs/zwavejs2mqtt:latest

# Using a local folder as persistence
mkdir store
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/ttyACM0 -v $(pwd)/store:/usr/src/app/store zwavejs/zwavejs2mqtt:latest

# As a service
wget https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/docker/docker-compose.yml
docker-compose up
```

> [!NOTE]
> Replace `/dev/ttyACM0` with the serial device for your Z-Wave stick
>
> If you are using the Z-Wave JS web socket server for Home Assistant, replace `3000:3000` with the port choosen in settings

For more info about docker check [here](https://github.com/zwave-js/zwavejs2mqtt/tree/master/docker/README.md)

## Kubernetes

```bash
kubectl apply -k https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/kustomization.yaml
```

> [!TIP]
> You will likely need to instead use this as a base, and then layer on top patches or resource customizations to suit your needs. Alternatively, copy all of the resources from the [kubernetes resources](https://github.com/zwave-js/zwavejs2mqtt/tree/master/kubernetes) directory of this repository.

## Snap package

Make sure you have a [Snapd installed](https://snapcraft.io/docs/installing-snapd). It's shipped with most Ubuntu flavors and some other distributions.

```bash
sudo snap install zwavejs2mqtt
```

And give the package access to use USB devices and observe hardware. The second one is needed for the program to list available devices in the UI.

```bash
sudo snap connect zwavejs2mqtt:raw-usb
sudo snap connect zwavejs2mqtt:hardware-observe
```

> [!NOTE]
> See `zwavejs2mqtt.help` for usage and environment settings.
>
> Raspberry Pi users running Rasbian/Debian, read [this thread](https://github.com/zwave-js/zwavejs2mqtt/discussions/1216#discussion-3364776). Please ask Rasbian/Debian related-questions in this thread.

## NodeJS or PKG version

The most complex way to run ZWavejs2mqtt is on bare metal. To do so, you can use the packaged version (you don't need NodeJS/yarn installed) or clone this repository and build the project:

- For the packaged version:

    ```bash
    cd ~
    mkdir zwavejs2mqtt
    cd zwavejs2mqtt
    # download latest version
    curl -s https://api.github.com/repos/zwave-js/zwavejs2mqtt/releases/latest  \
    | grep "browser_download_url.*zip" \
    | cut -d : -f 2,3 \
    | tr -d \" \
    | wget -i -
    unzip zwavejs2mqtt-v*.zip
    ./zwavejs2mqtt
    ```

- If you want to compile last code from github:

    ```bash
    git clone https://github.com/zwave-js/zwavejs2mqtt
    cd zwavejs2mqtt
    yarn install
    yarn run build
    yarn start
    ```
