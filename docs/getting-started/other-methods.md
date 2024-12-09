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

## NPM

You can install Z-Wave JS UI from NPM:

```bash
npm install -g zwave-js-ui
```

And run it with:

```bash
zwave-js-ui
```

> [!WARNING]
> You **MUST** configure a custom storage path using an environment variable, otherwise settings will be lost on updates.

Run with custom storage path:

```bash
STORE_DIR=~/.zwave-js-ui \
zwave-js-ui
```

If you want to run it as a service, you can use [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
```

Create a file named `ecosystem.config.js` with the following content (change the paths to match your system):

```js
module.exports = {
  apps : [
      {
        out_file: "/dev/null", // disable logs, use log to file when needed
        error_file: "/dev/null", // disable logs, use log to file when needed
        cwd: "~/",
        script: "zwave-js-ui",
        env: {
          STORE_DIR: "~/.zwave-js-ui",
        },
      },
  ]
}
```

And run it with:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## NodeJS or PKG version

The most complex way to run Z-Wave JS UI is on bare metal. To do so, you can use the packaged version (you don't need NodeJS/NPM installed) or clone this repository and build the project:

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
    npm install
    npm run build
    npm start
    ```
