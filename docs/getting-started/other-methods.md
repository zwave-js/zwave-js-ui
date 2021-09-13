# Other Methods to Run Zwavejs2Mqtt

## Kubernetes

To run ZWavejs2Mqtt as a Kubernetes deployment, download the `kustomization.yaml` file found [here](https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/kuberenets/kustomization.yaml):

```bash
kubectl apply -k https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/kuberenets/kustomization.yaml
```

> [!NOTE]
> Replace the `/dev/serial/by-id/insert_stick_reference_here` reference in the `deployment.yaml` file with the serial device for your Z-Wave stick.

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

The most complex way to run ZWavejs2Mqtt is on bare metal. To do so, you can use the packaged version (you don't need NodeJS/yarn installed) or clone this repository and build the project:

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
