# Accessing from Within Home Assistant

The Z-Wave JS UI Control Panel UI can be accessed from within Home Assistant by using the official [addon](https://github.com/hassio-addons/addon-zwave-js-ui) if running Home Assistant OS or Home Assistant Supervised, or by adding a panel to a Lovelace dashboard using the Raw Configuration Editor and substituting your IP address into the below.

First, add a new Lovelace dashboard. In the dashboard:

1. Click on the top right and 'Edit Dashboard'.
2. Turn on the "Start with an empty dashboard" switch, then click "Take Control"
3. Click on the top right, and then select "Raw configuration editor"
4. Paste the code below and save

```yaml
views:
 - title: Z-Wave JS UI
   panel: true
   cards:
     - type: iframe
       url: 'http://127.0.0.1[OR SUBSTITUTE YOUR IP ADDRESS HERE]:8091/'
       aspect_ratio: 100%
```

Alternatively, you can add a new tab to a pre-existing dashboard by inserting the above yaml into the pre-existing dashboard's raw configuration.

> [!NOTE]
> If you access Home Assistant via https, you must also configure Z-Wave JS UI to use https by setting the `HTTPS` [environment variable](guide/env-vars.md).
