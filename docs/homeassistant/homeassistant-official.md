# Home Assistant Using the Official Integration

To integrate your Z-Wave components you can use either the official Home Assistant [Z-Wave JS integration](https://www.home-assistant.io/integrations/zwave_js) and/or MQTT discovery.

## Z-Wave JS server

The Z-Wave JS server is the official way to integrate your Z-Wave devices with Home Assistant. In order to use it go to Settings, [Home Assistant](/usage/setup?id=home-assistant) and enable the flag **WS Server**. Using this method, the official [Z-Wave JS integration](https://www.home-assistant.io/integrations/zwave_js) will automatically create entities in Home Assistant.

If you do not need the MQTT features, you can [Disable MQTT Gateway](/usage/setup?id=disable-gateway) and use Zwavejs2Mqtt as an additional user interface to control your Z-Wave network.

## Assistance with the Official Integration

Should you need support with the official Home Assistant Integration, please consult that project's [documentation](https://www.home-assistant.io/integrations/zwave_js/).

Support tickets relating to Home Assistant should first be submitted to the Home Assistant [project](https://github.com/home-assistant/core), who will redirect the ticket to Z-Wave JS if need be.
