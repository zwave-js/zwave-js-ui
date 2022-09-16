# zwave-js-ui

![GitHub package.json version](https://img.shields.io/github/package-json/v/zwave-js/zwave-js-ui)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MadeWithVueJs.com shield](https://madewithvuejs.com/storage/repo-shields/1897-shield.svg)](https://madewithvuejs.com/p/zwave2mqtt/shield-link)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png)](https://opensource.org/licenses/mit-license.php)
[![ci](https://github.com/zwave-js/zwave-js-ui/workflows/ci/badge.svg?branch=master)](https://github.com/zwave-js/zwave-js-ui/actions?query=workflow%3Aci+branch%3Amaster)
[![Docker Release](https://github.com/zwave-js/zwave-js-ui/actions/workflows/docker-release.yml/badge.svg)](https://github.com/zwave-js/zwave-js-ui/actions/workflows/docker-release.yml)
[![GitHub All Releases](https://img.shields.io/github/downloads/zwave-js/zwave-js-ui/total)](https://github.com/zwave-js/zwave-js-ui/releases)
[![Coverage Status](https://coveralls.io/repos/github/zwave-js/zwave-js-ui/badge.svg?branch=master)](https://coveralls.io/github/zwave-js/zwave-js-ui?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/zwave-js/zwave-js-ui/badge.svg?targetFile=package.json)](https://snyk.io/test/github/zwave-js/zwave-js-ui?targetFile=package.json)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/zwave-js/zwave-js-ui.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/zwave-js/zwave-js-ui/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/zwave-js/zwave-js-ui.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/zwave-js/zwave-js-ui/context:javascript)

[![Join channel](https://img.shields.io/badge/SLACK-zwave--js.slack.com-red.svg?style=popout&logo=slack&logoColor=red)](https://join.slack.com/t/zwave-js/shared_invite/zt-8ns655f6-d407vtI~KjU~1z11jyaQ9Q "Join channel")

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/MVg9wc2HE "Buy Me A Coffee") [<img style="background:#ccc;border-radius:10px" alt="PayPal" src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg" alt="PayPal" width="200" height="40px" />](https://paypal.me/daniellando) [![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/bePatron?u=16906849)

[![dockeri.co](https://dockeri.co/image/zwavejs/zwave-js-ui)](https://hub.docker.com/r/zwavejs/zwave-js-ui)

<div>
  <img src="docs/_images/zwavejs_logo.svg" width="300" alt="zwavejs">
  <span style="font-size: 25px">TO</span>
  <img src="docs/_images/MQTT-Logo.png" alt="mqtt">
</div>

Full featured Z-Wave **Control Panel** and MQTT **Gateway**.

- **Backend**: [NodeJS](https://nodejs.org/en/), [Express](https://expressjs.com/), [socket.io](https://github.com/socketio/socket.io), [Mqttjs](https://github.com/mqttjs/MQTT.js), [zwavejs](https://github.com/zwave-js/node-zwave-js), [Webpack](https://webpack.js.org/)
- **Frontend**: [Vue](https://vuejs.org/), [socket.io](https://github.com/socketio/socket.io), [Vuetify](https://github.com/vuetifyjs/vuetify)

## Main features

- **Full-Featured Z-Wave to MQTT Gateway**: Expose Z-Wave devices to an MQTT broker in a fully configurable manner
- **Secured**: Supports *HTTPS* and *user authentication*
- **Control Panel UI**: Directly control your nodes and their values from the UI, including:
  - *Nodes management*: Add, remove, and configure all nodes in your Z-Wave network
  - *Firmware updates*: Update device firmware using manufacturer-supplied firmware files
  - *Groups associations*: Add, edit, and remove direct node associations
  - *Z-Wave JS Exposed*: Provides full-access to Z-Wave JS's APIs
- **Scene Management**: Create scenes and trigger them by using MQTT apis (with timeout support)
- **Debug Logs in the UI**: See debug logs directly from the UI
- **Access Store Files in the UI**: Access the files are stored in the persistent `store` folder directly from the UI
- **Network Graph**: Provides a beautiful map showing how nodes are communicating with the controller
- **Supports the Official Home Assistant Integration**: Can act as the backend driver for the official Home Assistant integration, using the same driver and socket server as the official addon
- **Supports Home Assistant Discovery via MQTT**: In lieu of the official integation, can be used to expose Z-Wave devices to Home Assistant via MQTT discovery.
- **Supported by Domoticz** (beta 2021.1) using MQTT Autodiscovery.
- **Automatic/Scheduled backups**: Scheduled backup of NVM and store directory. It's also possible to enable automatic backups of NVM before every node inclusion/exclusion/replace, this ensures to create a safe restore point before any operation that can cause a network corruption.

## Documentation

[Project documentation](https://zwave-js.github.io/zwave-js-ui/#/)
