# Zwave To MQTT

![GitHub package.json version](https://img.shields.io/github/package-json/v/zwave-js/zwavejs2mqtt)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MadeWithVueJs.com shield](https://madewithvuejs.com/storage/repo-shields/1897-shield.svg)](https://madewithvuejs.com/p/zwavejs2mqtt/shield-link)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png)](https://opensource.org/licenses/mit-license.php)
[![ci](https://github.com/zwave-js/zwavejs2mqtt/workflows/ci/badge.svg?branch=master)](https://github.com/zwave-js/zwavejs2mqtt/actions?query=workflow%3Aci+branch%3Amaster)
[![Docker Build](https://github.com/zwave-js/zwavejs2mqtt/workflows/Docker%20Build/badge.svg?branch=master)](https://github.com/zwave-js/zwavejs2mqtt/actions?query=workflow%3A%22Docker+Build%22+branch%3Amaster)
[![GitHub All Releases](https://img.shields.io/github/downloads/zwave-js/zwavejs2mqtt/total)](https://github.com/zwave-js/zwavejs2mqtt/releases)
[![Coverage Status](https://coveralls.io/repos/github/zwave-js/zwavejs2mqtt/badge.svg?branch=master)](https://coveralls.io/github/zwave-js/zwavejs2mqtt?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/zwave-js/zwavejs2mqtt/badge.svg?targetFile=package.json)](https://snyk.io/test/github/zwave-js/zwavejs2mqtt?targetFile=package.json)
[![Dependencies Status](https://david-dm.org/zwave-js/zwavejs2mqtt/status.svg)](https://david-dm.org/zwave-js/zwavejs2mqtt)
[![devDependencies Status](https://david-dm.org/zwave-js/zwavejs2mqtt/dev-status.svg)](https://david-dm.org/zwave-js/zwavejs2mqtt?type=dev)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/zwave-js/zwavejs2mqtt.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/zwave-js/zwavejs2mqtt/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/zwave-js/zwavejs2mqtt.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/zwave-js/zwavejs2mqtt/context:javascript)

[![Join channel](https://img.shields.io/badge/SLACK-zwave2mqtt.slack.com-red.svg?style=popout&logo=slack&logoColor=red)](https://join.slack.com/t/zwave2mqtt/shared_invite/enQtNjc4NjgyNjc3NDI2LTc3OGQzYmJlZDIzZTJhMzUzZWQ3M2Q3NThmMjY5MGY1MTc4NjFiOWZhZWE5YjNmNGE0OWRjZjJiMjliZGQyYmU "Join channel")

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/MVg9wc2HE "Buy Me A Coffee")

[![dockeri.co](https://dockeri.co/image/zwavejs/zwavejs2mqtt)](https://hub.docker.com/r/zwavejs/zwavejs2mqtt)

<div>
  <img src="docs/_images/zwavejs_logo.svg" width="300" alt="zwavejs">
  <span style="font-size: 25px">TO</span>
  <img src="docs/_images/MQTT-Logo.png" alt="mqtt">
</div>

Fully configurable Zwave to MQTT **Gateway** and **Control Panel**.

- **Backend**: [NodeJS](https://nodejs.org/en/), [Express](https://expressjs.com/), [socket.io](https://github.com/socketio/socket.io), [Mqttjs](https://github.com/mqttjs/MQTT.js), [zwavejs](https://github.com/zwave-js/node-zwave-js), [Webpack](https://webpack.js.org/)
- **Frontend**: [Vue](https://vuejs.org/), [socket.io](https://github.com/socketio/socket.io), [Vuetify](https://github.com/vuetifyjs/vuetify)

## Features

- Configurable Zwave to Mqtt Gateway
- Home Assistant integration (**beta**)
- Zwave Control Panel:
  - **Nodes management**: check all nodes discovered in the z-wave network, send/receive nodes values updates directly from the UI and send action to the nodes and controller for diagnostics and network heal
  - **Custom Node naming and Location**: Starting from v1.3.0 nodes `name` and `location` are stored in a JSON file named `nodes.json`. This because not all nodes have native support for naming and location features ([#45](https://github.com/zwave-js/zwavejs2mqtt/issues/45)). This change is back compatible with older versions of this package: on startup it will get all nodes names and location from the `zwcfg_homeHEX.xml` file (if present) and create the new `nodes.json` file based on that. This file can be imported/exported from the UI control panel with the import/export buttons placed on the top of nodes table, on the right of controller actions select.
  - **Firmware updates**: You are able to send firmware updates to your devices using the UI, just select the controller action `Begin Firmware Update`
  - **Groups associations**: create associations between nodes (also supports multi-instance associations, need to use last version of zwave-js)
  - **Custom scenes management**
- Log debug in UI
- Mesh graph showing devices neighbors
