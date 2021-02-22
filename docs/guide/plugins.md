# Plugins

Plugins are nodejs packages that can be initegrated in zwavejsmqtt in order to add new features. They are have access to all the clients (zwave and mqtt) and express instance.

## Installing Plugin

### Installation

you can install a plugin using `npm i` (install) command. It is advised to run this command after building.

example installing `@user/plugin-name`

```bash
npm i @user/plugin-name
```

### Building it using docker file

Building the container is straight forward. an example of build command installing two plugins `@user/plugin-name`

```bash
docker build -f docker/Dockerfile --build-arg plugins='@user/plugin-name' -t <docker image name>:<tag> .
```

Once container is built we need to configure our `store/settings.json`

An example of valid config is:

```json
{
  "mqtt": {
    ...
  },
  "gateway": {
    ...
  },
  "zwave": {
    ...
    "plugin": "@user/plugin-name"
  }
}
```
