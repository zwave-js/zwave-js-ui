# Z-Wave JS UI

<div>
  <img style="background-color: #fff; border-radius: 15px" src="docs/_images/app_logo.svg" alt="Z-Wave JS UI">
</div>

![GitHub package.json version](https://img.shields.io/github/package-json/v/zwave-js/zwave-js-ui)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MadeWithVueJs.com shield](https://madewithvuejs.com/storage/repo-shields/1897-shield.svg)](https://madewithvuejs.com/p/zwave2mqtt/shield-link)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png)](https://opensource.org/licenses/mit-license.php)
[![ci](https://github.com/zwave-js/zwave-js-ui/workflows/ci/badge.svg?branch=master)](https://github.com/zwave-js/zwave-js-ui/actions?query=workflow%3Aci+branch%3Amaster)
[![Docker Release](https://github.com/zwave-js/zwave-js-ui/actions/workflows/docker-release.yml/badge.svg)](https://github.com/zwave-js/zwave-js-ui/actions/workflows/docker-release.yml)
[![GitHub All Releases](https://img.shields.io/github/downloads/zwave-js/zwave-js-ui/total)](https://github.com/zwave-js/zwave-js-ui/releases)
[![Coverage Status](https://coveralls.io/repos/github/zwave-js/zwave-js-ui/badge.svg?branch=master)](https://coveralls.io/github/zwave-js/zwave-js-ui?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/zwave-js/zwave-js-ui/badge.svg?targetFile=package.json)](https://snyk.io/test/github/zwave-js/zwave-js-ui?targetFile=package.json)

[![Discord](https://img.shields.io/discord/1111193770935996459?color=D82167&label=Chat%20on%20Discord&logo=Discord&logoColor=ffffff)](https://discord.gg/HFqcyFNfWd)

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/MVg9wc2HE "Buy Me A Coffee") [<img style="background:#ccc;border-radius:10px" alt="PayPal" src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg" width="200" height="40px" />](https://paypal.me/daniellando) [![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/bePatron?u=16906849) [<img src="https://liberapay.com/assets/widgets/donate.svg" alt="Donate using Liberapay" />](https://liberapay.com/robertsLando/donate)[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I1JN3M5)

[![dockeri.co](https://dockerico.blankenship.io/image/zwavejs/zwave-js-ui)](https://hub.docker.com/r/zwavejs/zwave-js-ui) [![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/zwave-js-ui)

Full featured Z-Wave **Control Panel** and MQTT **Gateway**.

- **Backend**: [NodeJS](https://nodejs.org/en/), [Express](https://expressjs.com/), [socket.io](https://github.com/socketio/socket.io), [MQTTjs](https://github.com/mqttjs/MQTT.js), [zwavejs](https://github.com/zwave-js/node-zwave-js), [Webpack](https://webpack.js.org/)
- **Frontend**: [Vue](https://vuejs.org/), [socket.io](https://github.com/socketio/socket.io), [Vuetify](https://github.com/vuetifyjs/vuetify)

## Main features

- **Control Panel UI**: Directly control your nodes and their values from the UI, including:
  - *Nodes management*: Add, remove, and configure all nodes in your Z-Wave network
  - *Firmware updates*: Update device firmware using manufacturer-supplied firmware files
  - *Groups associations*: Add, edit, and remove direct node associations
  - *Z-Wave JS Exposed*: Provides full-access to Z-Wave JS's APIs
- **Full-Featured Z-Wave to MQTT Gateway**: Expose Z-Wave devices to an MQTT broker in a fully configurable manner
- **Secured**: Supports *HTTPS* and *user authentication*
- **Scene Management**: Create scenes and trigger them by using MQTT apis (with timeout support)
- **Debug Logs in the UI**: See debug logs directly from the UI
- **Access Store Files in the UI**: Access the files are stored in the persistent `store` folder directly from the UI
- **Network Graph**: Provides a beautiful map showing how nodes are communicating with the controller
- **Automatic/Scheduled backups**: Scheduled backup of NVM and store directory. It's also possible to enable automatic backups of NVM before every node inclusion/exclusion/replace, this ensures to create a safe restore point before any operation that can cause a network corruption.
- **Zniffer Support**: Supports Zniffer mode for debugging Z-Wave traffic
- **Dianogsitics**: Use Healtcheck and Link quality tools to diagnose network issues

## Software integrations

- [Home Assistant](https://www.home-assistant.io/): using the official [addon](https://github.com/hassio-addons/addon-zwave-js-ui) or standalone installation through plain MQTT or MQTT Discovery. See [docs](https://zwave-js.github.io/zwave-js-ui/#/homeassistant/homeassistant-mqtt)
- [Domoticz](https://www.domoticz.com/): using MQTT Discovery. See [docs](https://www.domoticz.com/wiki/Zwave-JS-UI)
- [OpenHAB](https://www.openhab.org/): using MQTT Discovery. See [docs](https://community.openhab.org/t/zwave-js-ui-in-place-of-oh-zwave-binding/150007/102)
- [Jeedom](https://www.jeedom.com/en/): using official Z-Wave JS [plugin](https://doc.jeedom.com/en_US/plugins/automation%20protocol/zwavejs/beta/)
- [HomeSeer](https://homeseer.com/): Using [Z-Wave Plus Plugin](https://docs.homeseer.com/products/setting-up-the-z-wave-plus-plugin)

## Documentation

[Project documentation](https://zwave-js.github.io/zwave-js-ui/#/)
