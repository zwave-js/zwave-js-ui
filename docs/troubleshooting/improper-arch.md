# Improper Architecture

If you get the error `standard_init_linux.go:207: exec user process caused "exec format error"`, you most likely installed the wrong package intended for a different architecture than your system. To recover, you must delete the existing volume that contains the old executable:

`docker volume rm zwave-js-ui`

Check files inside volume

```bash
docker run --rm -it --mount source=zwave-js-ui,target=/usr/src/app zwavejs/zwave-js-ui:latest find /usr/src/app
```

Delete Volume

```bash
docker volume rm zwave-js-ui
```
