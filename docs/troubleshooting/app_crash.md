# Startup crash

This is a list of issues and solutions that may help you to solve startup problems.

## Application does not start after updating to version 5.10.x or higher

The error message looks like this:

```bash
Failed to initialize the driver: ZWaveError: The driver is not ready or has been destroyed
```

If this happens on Linux (e.g. Raspberry Pi), it can happen that the USB stick gets a new address on reboot, for example changes from `/dev/ttyUSB0` to `/dev/ttyUSB1`.

This can be avoided by using a fixed address for the USB stick. To do this, execute

```bash
ls -l /dev/serial/by-id
```

on the console and determine which of them corresponds to the Z-Wave stick, recognizable by the referenced path:

```bash
...
lrwxrwx 1 root root 13 Oct 25 20:19 usb-Silicon_Labs_CP2102N_USB_to_UART_Bridge_Controller_8ad925bd7b84e911a7a1d6217343c2-if00-port0 -> ../../ttyUSB0
```

In this case

```bash
/dev/serial/by-id/usb-Silicon_Labs_CP2102N_USB_to_UART_Bridge_Controller_8ad925bd7b84e911a7a7a1d6217343c2-if00-port0
```

should be entered in the Z-Wave settings instead of `/dev/ttyUSB0`.

If this does not help, the stick restart can be disabled by disabling __Soft Reset__ option under Z-Wave settings, but this may limit functionality.

> This is definitely necessary with the zwave.me UZB1. However, the adapter tries to detect this stick by itself.
