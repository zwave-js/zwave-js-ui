# Improper Architecture

If you get the error `standard_init_linux.go:207: exec user process caused "exec format error"`, you most likely installed the wrong package intended for a different architecture than your system. To recover, you must delete the existing volume that contains the old executable:

`docker volume rm zwavejs2mqtt`

Check files inside volume

```bash
docker run --rm -it --mount source=zwavejs2mqtt,target=/usr/src/app zwavejs/zwavejs2mqtt:latest find /usr/src/app
```

Delete Volume

```bash
docker volume rm zwavejs2mqtt
```
