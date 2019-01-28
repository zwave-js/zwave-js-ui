
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.png?v=103)](https://opensource.org/licenses/mit-license.php)

![OpenZWave](docs/OZW_Logo.png)
![MQTT](docs/MQTT-Logo.png)

# Zwave2Mqtt

Fully configurable Zwave to MQTT gateway and Control Panel.

- **Backend**: NodeJS, Express, socket.io Webpack
- **Frontend**: Vue,  socket.io [Vuetify](https://github.com/vuetifyjs/vuetify)


## Installation

1. Firstly you need to install [Open-Zwave](https://github.com/OpenZWave/open-zwave) library on your system. If you are using Ubuntu:

```sh
sudo apt-get install libudev-dev
cd ~
wget http://old.openzwave.com/downloads/openzwave-1.4.1.tar.gz
tar zxvf openzwave-*.gz
cd openzwave-* && make && sudo make install
export LD_LIBRARY_PATH=/usr/local/lib
sudo sed -i '$a LD_LIBRARY_PATH=/usr/local/lib' /etc/environment
```

For Raspberry check [here](https://github.com/OpenZWave/node-openzwave-shared/blob/master/README-raspbian.md#2-install-the-open-zwave-library-on-your-raspberry)

2. Test the library: go to openzwave directory `cd openzwave-*` and run the command

  `MinOZW /dev/ttyACM0`

  > replace `/dev/ttyACM0` with the USB port where your controller is connected

3. Clone this repo:

`git clone https://github.com/robertsLando/Zwave2Mqtt.git`

4. Install modules and build the project:

```sh
cd Zwave2Mqtt
npm install
npm run build
```

5. Start the application: `npm start`

6. Go to http://localhost:8091

## Development

Developers who wants to debug the application have to open 2 terminals.

In first terminal run `npm run dev` to start webpack-dev for front-end developing and hot reloading at http://localhost:8092
(**THE PORT IS 8092 FOR DEVELOPING**)

In the second terminal run `nodemon --inspect bin/www` to start the backend server with automatically restart after changes (if you don't have nodemon installed: `npm install -g nodemon`)

## Usage

Firstly you need to open the browser at the link http://localhost:8091 and edit the settings.

You need to enter the configuration parameters for Zwave, MQTT and the Gateway.

#### Zwave

Zwave settings are:

- **Serial port**: The serial port where your controller is connected
- **Network key** (Optional): Zwave network key if security is enabled
- **Logging**: Enable/Disable Openzwave Library logging
- **Save configuration**: Store zwave configuration in `zwcfg_<homeHex>.xml` and `zwscene.xml` files this is needed for peristent node information like node name and location
- **Poll interval**: Interval in milliseconds between pools


#### MQTT

Mqtt settings are:

- **Name**: A unique name that identify the Gateway.
- **Host**: The url of the broker
- **Port**: Port the broker is listening on
- **Reconnect period**: Milliseconds between two reconnection tries
- **Prefix**: The prefix where all values are published
- **QoS**: Quality Of Service (check MQTT specs) of outcoming packets
- **Retain**: The retain flag of outcoming packets
- **Clean**: Sets the clean flag when connecting to the broker
- **Store**: Enable/Disable persistent storage of packets. If disabled in memory storage will be used but all packets stored in memory are lost in case of shutdowns or unexpected errors.
- **Auth**: Enable this if broker requires auth. If so you need to enter also a valid username and password.

#### Gateway

Gateway settings are:

- **Gateway type**: This setting specify the logic used to publish Zwave Nodes Values in MQTT topics. At the moment there are 3 possible configuration, two are automatic (all values are published in a specific topic) and one allows to manually configure which values you want to publish for each device type:

1. **ValueId Topics**: *Automatically configured*. The topic where zwave values are published will be:

`<mqtt_prefix>/<?node_location>/<node_id>/<class_id>/<instance>/<index>`

- `mqtt_prefix`: the prefix set in Mqtt Settings
- `node_location`: the location of the Zwave Node (optional, if not present will not be added to the topic)
- `node_id`: the unique numerical id of the node in Zwave network
- `class_id`: the numerical class id of the value
- `instance`: the numerical value of value instance
- `index`: the numerical index of the value

2. **Named Topics**: *Automatically configured*. The topic where zwave values are published will be:

`<mqtt_prefix>/<?node_location>/<node_name>/<class_name>/<value_label>`

- `mqtt_prefix`: the prefix set in Mqtt Settings
- `node_location`: the location of the Zwave Node (optional, if not present will not be added to the topic)
- `node_name`: the name of the node, if not set will be `nodeID_<node_id>`
- `class_name`: the node class name corrisponding to given class id or `unknownClass_<class_id>` if the class name is not found
- `value_label`: the zwave value label (lower case and spaces are replaced with `_`)

3. **Configured Manually**: *Needs configuration*. The topic where zwave values are published will be:

`<mqtt_prefix>/<?node_location>/<node_name>/<value_topic>`

- `mqtt_prefix`: the prefix set in Mqtt Settings
- `node_location`: the location of the Zwave Node (optional, if not present will not be added to the topic)
- `node_name`: the name of the node, if not set will be `nodeID_<node_id>`
- `value_topic`: the topic of the value. This is manually configured in Gateway settings by popolating a table with the values that I want to read from each device of a specific type in my network. Once scan is complete, the gateway creates an array with all devices types found in the network. A device has a `device_id` that is unique, it is composed by this node properties: `<manufacturerid>-<productid>-<producttype>`.

- **Payload type**: The content of the payload when an update is published:
  - **JSON Time-Value**: The payload will be a JSON object like:

```json
{
  "time": 1548683523859,
  "value": 10
}
```

  - **Entire Zwave value Object**
  The payload will contain all info of a value from Zwave network:

  ```json
  {
    "value_id": "3-64-1-0",
    "node_id": 3,
    "class_id": 64,
    "type": "list",
    "genre": "user",
    "instance": 1,
    "index": 0,
    "label": "Mode",
    "units": "",
    "help": "",
    "read_only": false,
    "write_only": false,
    "min": 0,
    "max": 0,
    "is_polled": false,
    "values": ["Off", "Heat (Default)", "Cool", "Energy Heat"],
    "value": "Off",
  }
   ```

   - **Just value**: The payload will contain only the row Numeric/String value

- **Send 'list' as integer**: Zwave 'list' values are sent as list index instead of string values

## Features

- Configurable Zwave to Mqtt Gateway
- Log debug in UI
- Zwave Control Panel:
  - **Nodes management**: check nodes status in the network, change nodes `name` and `location`, get nodes values and configure them, send actions to controller and import/export zwave configuration files
  - **Groups associations**: create associations between nodes (also supports multi-instance associations, need to use last version of openzwave-shared)
  - **Custom scenes management**: (OpenZwave-Shared scenes management has actually some bugs and it's limited so I have made a custom scenes implementation that uses the same APIs but stores values in a JSON file that can be imported/exported and also allows to set a timeout to a value in a scene)

## Screenshots

Settings

![OpenZWave](docs/settings.png)

Control Panel

![Control Panel](docs/OZW_Panel_Node.png)

Groups associations

![Groups](docs/groups_associations.png)

Scenes

![Scenes](docs/scenes.png)

Debug

![Debug](docs/debug.png)


## Authors

[Daniel Lando](https://github.com/robertsLando)
