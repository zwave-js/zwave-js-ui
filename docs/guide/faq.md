# FAQ

> A: Why when I add a value to Gateway values table I don't see all my devices?

**B: When adding values to the gateway values table it shows JUST ONE DEVICE FOR EACH TYPE. This is to make it easier and faster to setup your network as if you have a network with lot devices (light, light dimmers for example) you just need to add the values you want to bridge to mqtt (for a light it will always be just the switch to turn it on/off for example without all configuration values) and it will bridge those values for all the devices of that type (without configure the values one by one).**

> A: My device is X and has been discovered as Y, why?

**B: Home Assistant Discovery is not easy, zwave have many different devices with different values. Unfortunately not all devices respect specifications so for those cases we have created the Home Assistant devices table where you can manually fix the discovery payload and then save it to make it persistent. We have also created a file `/hass/devices.js` where we place all devices specific values configuration, your contribution is needed there, so submit a PR with your files specification to help it grow.**

> A: I have the following message: "Driver: Failed to open the serial port: Error: Operation not permitted, cannot open /dev/ttyAMA0". I can't retrieve my Zwave usb device.

**B: It could append that your usb device is not properly mounted. Here are some commands that can help to fix issues:**
- Display the list of usb devices with `lsusb`
```Bus 002 Device 001: ID 1d6b:0003 Linux Foundation 3.0 root hub
Bus 001 Device 003: ID 0658:0200 Sigma Designs, Inc. Aeotec Z-Stick Gen5 (ZW090) - UZB
Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
```
- If your device is listed, unplug it and enter the following command: `sudo dmesg -C`.
Plug it again, enter the following command: `dmesg > usb.txt` then `more usb.txt`
```2772.462558] usb 1-4: new full-speed USB device number 5 using xhci_hcd
[ 2772.612186] usb 1-4: New USB device found, idVendor=0658, idProduct=0200, bcdDev
ice= 0.00
[ 2772.612194] usb 1-4: New USB device strings: Mfr=0, Product=0, SerialNumber=0
[ 2772.612477] usb 1-4: Device is not authorized for usage
```
- If your device is not authorized, enter: `sudo usbguard list-devices --blocked`.
```6: block **id 0658:0200 serial "" name "" hash "XXXX" parent-hash "XXXX" via-port "1-4" with-interface { 02:02:01 0a:00:00 } with-connect-type "unknown"
```
- If your device is listed: `sudo usbguard allow-device -p X` where X is your device id (6 in this case)
- Then restart zwave-js-ui: `sudo zwave-js-ui.restart`
- Now another your device should be available with a new name (check /dev folder).  

