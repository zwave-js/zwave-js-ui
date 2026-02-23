# FAQ

> A: Why when I add a value to Gateway values table I don't see all my devices?

**B: When adding values to the gateway values table it shows JUST ONE DEVICE FOR EACH TYPE. This is to make it easier and faster to setup your network as if you have a network with lot devices (light, light dimmers for example) you just need to add the values you want to bridge to mqtt (for a light it will always be just the switch to turn it on/off for example without all configuration values) and it will bridge those values for all the devices of that type (without configure the values one by one).**

> A: My device is X and has been discovered as Y, why?

**B: Home Assistant Discovery is not easy, zwave have many different devices with different values. Unfortunately not all devices respect specifications so for those cases we have created the Home Assistant devices table where you can manually fix the discovery payload and then save it to make it persistent. We have also created a file [`api/hass/devices.ts`](https://github.com/zwave-js/zwave-js-ui/blob/master/api/hass/devices.ts) where we place all devices specific values configuration, your contribution is needed there, so submit a PR with your files specification to help it grow.**

> A: How do I update Z-Wave JS UI?

**B: If you are using Docker, pull the latest image and recreate the container. Your settings are preserved in the `store` volume. If you installed via npm, run `npm install -g zwave-js-ui@latest`. Always check the [changelog](https://github.com/zwave-js/zwave-js-ui/releases) for breaking changes before updating.**

> A: How do I backup my configuration?

**B: Go to Settings -> General -> Backup & Restore and click the backup button. This creates a zip file containing all your settings, network keys, and node configurations. You can also simply back up your entire `store` directory. It is strongly recommended to keep a backup of your security keys separately.**
