# Bug Report

When something isn't working as expected you should [open an issue](https://github.com/zwave-js/zwavejs2mqtt/issues/new/choose) on Github. To help us debugging your issue you should provide some additional informations like logs and node export if needed.

## Export Logs

The are two main loggers, one for zwavejs2mqtt and one for zwave-js module. To help us finding what's going on, when reporting a bug, you should attach the logs coming from both loggers.

Both loggers options are configurable from the UI in `Settings` page.

### Application logs

Zwavejs2mqtt logger can be configured in `General` section, enable `Log enabled` switch and `Log To File` and set `Log Level` to `silly`

> Log file name: `zwavejs2mqtt.log`

![Enable logging](../_images/log_z2m.gif)

### Driver logs

Driver logger can be configured in `Zwave` section, enable `Log enabled` switch and `Log To File` and set `Log Level` to `silly`

> Log file name: `zwavejs_<date>.log`

![Enable logging](../_images/log_zjs.gif)

### Download Zip

Your logs will be stored in separated files inside `store` folder.

You can easily download a zip with this logs files from the `Explorer` view on the UI. Just select the files you want to export (like we said above them will be `zwavejs2mqtt.log` and `zwavejs_<date>.log`), press on the fab button on the bottom right corner and press the download icon. Remember to attach the zip to your issue.

![Enable logging](../_images/download_zip.gif)

## Export node.json

Each node hass an Export button, this will export all data of this specific node. To perform this export, use our screen shots and steps as your guide.

1. Select node from the web ui
2. Click on advanced button
3. Select `Export Json`
4. Grab the file and attach it on your github Issue

![Export node](../_images/export_node.gif)

You can also export all nodes, just press on the `Advanced` button on the top of control panel table and click on `Export` under `Dump`

![Dump nodes](../_images/nodes_dump.gif)

This is useful mostly when there are issue with hass mqtt discovery or mesh graph.
