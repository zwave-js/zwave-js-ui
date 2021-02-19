# Plugins

Plugins are now supported in the application. The plugin packages are not included when npm is installing packages

## Installing Plugin

### NPM Method

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
