# Other Methods to Run Z-Wave JS UI

## Kubernetes

To run Z-Wave JS UI as a Kubernetes deployment, download the `kustomization.yaml` file found [here](https://raw.githubusercontent.com/zwave-js/zwave-js-ui/master/kustomization.yaml):

```bash
kubectl apply -k https://raw.githubusercontent.com/zwave-js/zwave-js-ui/master/kustomization.yaml
```

> [!NOTE]
> Replace the `/dev/serial/by-id/insert_stick_reference_here` reference in the `deployment.yaml` file with the serial device for your Z-Wave stick.

> [!TIP]
> You will likely need to instead use this as a base, and then layer on top patches or resource customizations to suit your needs. Alternatively, copy all of the resources from the [kubernetes resources](https://github.com/zwave-js/zwave-js-ui/tree/master/kubernetes) directory of this repository.

## Snap package

Make sure you have a [Snapd installed](https://snapcraft.io/docs/installing-snapd). It's shipped with most Ubuntu flavors and some other distributions.

```bash
sudo snap install zwave-js-ui
```

And give the package access to use USB devices and observe hardware. The second one is needed for the program to list available devices in the UI.

```bash
sudo snap connect zwave-js-ui:raw-usb
sudo snap connect zwave-js-ui:hardware-observe
```

> [!NOTE]
> See `zwave-js-ui.help` for usage and environment settings.
>
> Raspberry Pi users running Raspbian/Debian, read [this thread](https://github.com/zwave-js/zwave-js-ui/discussions/1216#discussion-3364776). Please ask Raspbian/Debian related-questions in this thread.

## NodeJS or PKG version

The most complex way to run zwave-js-ui is on bare metal. To do so, you can use the packaged version (you don't need NodeJS/yarn installed) or clone this repository and build the project:

- For the packaged version:

    ```bash
    cd ~
    mkdir zwave-js-ui
    cd zwave-js-ui
    # download latest version
    curl -s https://api.github.com/repos/zwave-js/zwave-js-ui/releases/latest  \
    | grep "browser_download_url.*zip" \
    | cut -d : -f 2,3 \
    | tr -d \" \
    | wget -i -
    unzip zwave-js-ui-v*.zip
    ./zwave-js-ui
    ```

- If you want to compile last code from github:

    ```bash
    git clone https://github.com/zwave-js/zwave-js-ui
    cd zwave-js-ui
    yarn install
    yarn run build
    yarn start
    ```
