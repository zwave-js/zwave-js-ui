# Polling Legacy Z-Wave Devices

Some legacy devices don't report all of their values automatically and require polling to automatically update their values. Some platforms, such as Smartthigns and Open Z-Wave, poll such devices automatically whether you need them polled or not. Because such polling can have detrimental effects on your mesh network, zwave-js does not poll devices by default. Polling can quickly lead to network congestion and should be used very sparingly and only where necessary.

zwavejs2mqtt allows you to configure scheduled polling on a per-value basis, which you can use to keep only the values that you need updated.
It also allows you to poll individual values on-demand from your automations, which should be preferred over blindly polling all of the time, if possible.

> [!NOTE]
> Many values can only be polled together. For example `targetValue`, `currentValue` and `duration` for most of the switch-type CCs. Before enabling polling for all values of a node, users should check whether polling a single value already updates the desired other values too.

In order to enable Polling of specific values you need to go to the Settings page, expand the General section and add a new value to the Gateway Values table.

Press `NEW VALUE` to add a new value or on the `Pen Icon` in the actions column of the table to open the dialog to Add/Edit a value. Select the device, the valueId, enable the `Enable Poll` flag and set a `Poll interval` in seconds:

![Edit value](../_images/edit_gateway_value.png)

Press `SAVE` to upload your new settings to the server and it will automatically handle the polling based on your settings.
