# Quick Start

ZWavejs2Mqtt can be run in several different ways. The default method is with docker, but you can also use [Kubernetes, Snap, or NodeJS packages](getting-started/other-methods.md). Choose the one that best fits your needs.

After running ZWavejs2Mqtt using one of the below methods, you can access it in your web browser at <http://localhost:8091> on the machine on which it was run, or at the IP address of your remote installation on port 8091.

**You must edit the [settings](usage/setup.md) before ZWavejs2Mqtt will become functional.** A minimum set of settings are described [below](getting-started/quick-start?id=minimum-settings).

If you are using Home Assistant, the UI can be added to Lovelace so that it can be accessed from within Home Assistant using the [following instructions](homeassistant/accessing-lovelace.md).

## Docker

The easiest way to run ZWavejs2Mqtt is by using docker:

[x_serial-device_question.txt](https://github.com/zwave-js/zwavejs2mqtt/files/8965706/x_serial-device_question.txt)

```bash
# Using volumes as persistence
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/serial/by-id/insert_stick_reference_here:/dev/zwave \
--mount source=zwavejs2mqtt,target=/usr/src/app/store zwavejs/zwavejs2mqtt:latest

# Using a local folder as persistence
mkdir store
docker run --rm -it -p 8091:8091 -p 3000:3000 --device=/dev/serial/by-id/insert_stick_reference_here:/dev/zwave \
-v $(pwd)/store:/usr/src/app/store zwavejs/zwavejs2mqtt:latest

# As a service
wget https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/docker/docker-compose.yml
docker-compose up
```

> [!NOTE]
> Replace `/dev/serial/by-id/insert_stick_reference_here` (only the first half of the X:Y mapping!) with the serial device for your Z-Wave stick.

> [!WARNING]
>
> - Do not use /dev/ttyUSBX serial devices, as those mappings can change over time.
> - Instead, use the /dev/serial/by-id/X serial device for your Z-Wave stick.

For more info about using docker check [here](getting-started/docker.md)

## Minimum settings

A [complete](usage/setup.md) guide to the settings is available. At minimum, you should:

1. **Configure the serial port** [Settings -> Z-Wave -> Serial Port] (The template [Docker Compose file](https://github.com/zwave-js/zwavejs2mqtt/blob/master/docker/docker-compose.yml) maps the Z-Wave stick to /dev/zwave.)

2. **Add Network Security Keys** [Settings -> Z-Wave -> Security Keys (S0 Legacy, S2 Unauthenticated, S2 Authenticated, and S2 Access Control))

> [!NOTE]
>
> - These keys are used to connect securely to compatible devices. **You should define both S0 and S2 keys, even if you are not yet using S2.**
> - The network key consists of 32 hexadecimal characters, for example 2232666D100F795E5BB17F0A1BB7A146 (do not use this one, pick a random one).
> - You can generate a random key by clicking the double arrows at the end of the key box.
> - **Backup these keys!**

3. **Enable Z-Wave JS Logging** [Settings -> Z-Wave -> Log Enabled, then elect a Log Level]
4. **Enable ZWavejs2Mqtt Logging** [If using MQTT) (Settings -> General -> Log Enabled, then elect a Log Level]
5. **Disable MQTT Gateway** if not using MQTT [On the Settings Page]
6. **Configure Home Assistant if using Home Assistant** [Settings -> Home Assistant -> WS Server]
7. **Enable Statistics (please!)** [Settings -> Z-Wave -> Enable Statistics]
