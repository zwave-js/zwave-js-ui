# ZWave To MQTT Behind a Reverse Proxy

There are two ways to enable ZWave To MQTT to sit behing a proxy that uses
subpaths to serve the pages and services.

You can use a header to signal where the external path is or you can configure
the base path. In both cases these are dynamic configurations, so you can deploy
without having to build again the frontend.

## Using an HTTP header

You can pass the external path by setting the `X-External-Path` header, for example
suppose you had the following `nginx` configuration:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 9000 default_server;
    listen [::]:9000 default_server;

    location /hassio/ingress/ {
        proxy_pass http://localhost:8091/;
        proxy_set_header X-External-Path /hassio/ingress;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

This will tell the application to serve the application and relevant elements under
`/hassio/ingress/`.

In case you are using the [ingress of Home Assistant](https://www.home-assistant.io/blog/2019/04/15/hassio-ingress/) you will want to
pick up the `X-Ingress-Path;` and map it, something along
these lines:

```nginx
  proxy_set_header X-External-Path $http_x_ingress_path;
```

## Using the configuration

You can simply change the `config/app.js` and set `base` to whatever is
the subpath you will be serving this from.

As an example, if your proxy is placing the app behind `/zwave/` your configuration
would look like:

```javascript
module.exports = {
  title: 'ZWave to MQTT',
  storeDir: 'store',
  base: '/zwave/',
  port: 8091
}
```
