# Home Assistant Using the Official Integration

To integrate your Z-Wave components you can use either the official Home Assistant [Z-Wave integration](https://www.home-assistant.io/integrations/zwave_js) or MQTT discovery. To read more about the MQTT discovery, see [these docs](/usage/setup?id=home-assistant-using-mqtt-discovery).

> [!NOTE]
> Home assistant Z-Wave Integration is the recommended choice as MQTT discovery is much more limited and less maintained.

## Z-Wave integration

Home Assistant has an integration for Z-Wave which is based on Z-Wave JS. You can read more about this at the [Z-Wave integration](https://www.home-assistant.io/integrations/zwave_js) docs.

To enable the integration:

1. Open the Z-Wave JS UI Settings page
2. Enable the "WS Server" setting in the [Home Assistant](/usage/setup?id=home-assistant) panel
3. If you do not need the MQTT features, you can [Disable MQTT Gateway](/usage/setup?id=disable-gateway) and use Z-Wave JS UI as an additional user interface to control your Z-Wave network.
4. Configure the Z-Wave integration in Home Assistant by following [the official docs](https://www.home-assistant.io/integrations/zwave_js)

Once this has been configured, entities should automatically be created in HA.

### Assistance with the Official Integration

Should you need support with the official Home Assistant Integration, please consult that project's [documentation](https://www.home-assistant.io/integrations/zwave_js/).

Support tickets relating to Home Assistant should first be submitted to the Home Assistant [project](https://github.com/home-assistant/core), who will redirect the ticket to Z-Wave JS if need be.

## How it works

The following diagram shows the flow of data from the Z-Wave network to the Home Assistant application.

![Home Assistant](../_images/Home_Assistant_sketch.png)
