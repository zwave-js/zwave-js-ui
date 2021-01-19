# Logs export

The are two main loggers, one for zwavejs2mqtt and one for zwave-js module.

To help us finding what's going on, when reporting a bug, you should attach the logs coming from both loggers.

Both loggers options are configurable from the UI in `Settings`:

1. The ZwaveJS logger can be confgured in `Zwave` section, enable `Log enabled` switch and `Log To File` and set `Log Level` to `silly`
2. The zwavejs2mqtt logger can be confgured in `General` section, enable `Log enabled` switch and `Log To File` and set `Log Level` to `silly`

Now press on `SAVE` button to store the new settings and your logs will be stored in separeted files inside `store` folder. The zwavejs2mqtt log output file will be named `zwavejs2mqtt.log` and the zwavejs one `zwavejs_<processid>.log`

If you are using docker you can ssh inside the running container and/or use the `docker cp` command to download the files in the local filesystem.
