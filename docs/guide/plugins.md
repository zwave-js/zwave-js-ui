# Plugins

Plugins are now supported in the application.

In order to support these, we need:

1. Build docker with the plugin
2. Configure our settings.json (manually)

Building the container is straight forward. an example of build command installing two plugins `@varet/zj2m-prom-exporter` and `@varet/zj2m-influx`

```
TAG="v1.1.1-test"; docker build -f docker/Dockerfile --build-arg plugins="@varet/zj2m-prom-exporter @varet/zj2m-influx" -t localdocker.dc.rb11.eu/zwavejs2mqtt:${TAG} .
```

Once container is built we need to configure our `store/settings.json`

An example of valid config is:

```
{
  "mqtt": {
    "name": "home",
    ...
    "store": false
  },
  "gateway": {
    "type": 0,
    ...
    "sendEvents": false
  },
  "zwave": {
    "port": "/dev/tty.usbserial",
    ...
    "plugin": ["@varet/zj2m-prom-exporter", "@varet/zj2m-influx"]
  }
}
```
