# FAQ

> A: Why when I add a value to Gateway values table I don't see all my devices?

**B: When adding values to the gateway values table it shows JUST ONE DEVICE FOR EACH TYPE. This is to make it easier and faster to setup your network as if you have a network with lot devices (light, light dimmers for example) you just need to add the values you want to bridge to mqtt (for a light it will always be just the switch to turn it on/off for example without all configuration values) and it will bridge those values for all the devices of that type (without configure the values one by one).**

> A: My device is X and has been discovered as Y, why?

**B: Home Assistant Discovery is not easy, zwave have many different devices with different values. Unfortunately not all devices respect specifications so for those cases I have created Home Assistant Devices table where you can manually fix the discovery payload and then save it to make it persistent. I have also created a file `/hass/devices.js` where I place all devices specific values configuration, your contribution is needed there, so submit a PR with your files specification to help it grow.**
