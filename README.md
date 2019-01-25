# Zwave2Mqtt
Fully configurable Zwave to MQTT gateway and Control Panel using NodeJS and Vue.

### Installation

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

  > replace `/dev/ttyACM0` with the USB port where your controller connected

3. Clone this repo: `git clone https://github.com/robertsLando/Zwave2Mqtt.git`

4. Install modules and build the project:

```sh
cd Zwave2Mqtt
npm install
npm run build
```

5. Start the application: `npm start`

6. Go to http://localhost:8091

### Development

Developers who wants to debug the application have to open 2 terminals.

In first terminal run `npm run dev` to start webpack-dev for front-end developing

In the second terminal run `nodemon --inspect bin/www` to start the backend server

### Usage

The Gateway has 3 modes:

1. **ValueId Topics**: The topic where zwave values are published will be:

`<mqtt_prefix>/<?node_location>/<node_id>/<class_id>/<instance>/<index>`

- `mqtt_prefix`: the prefix set in Mqtt Settings
- `node_location`: the location of the Zwave Node (optional, if not present will not be added to the topic)
- `node_id`: the unique numerical id of the node in Zwave network
- `class_id`: the numerical class id of the value
- `instance`: the numerical value of value instance
- `index`: the numerical index of the value

2. **Named Topics**: The topic where zwave values are published will be:

`<mqtt_prefix>/<?node_location>/<node_name>/<class_name>/<value_label>`

- `mqtt_prefix`: the prefix set in Mqtt Settings
- `node_location`: the location of the Zwave Node (optional, if not present will not be added to the topic)
- `node_name`: the name of the node, if not set will be `nodeID_<node_id>`
- `class_name`: the node class name corrisponding to given class id or `unknownClass_<class_id>` if the class name is not found
- `value_label`: the zwave value label (lower case and spaces are replaced with `_`)

3. **Configured Manually**: The topic where zwave values are published will be:

`<mqtt_prefix>/<?node_location>/<node_name>/<value_topic>`

- `mqtt_prefix`: the prefix set in Mqtt Settings
- `node_location`: the location of the Zwave Node (optional, if not present will not be added to the topic)
- `node_name`: the name of the node, if not set will be `nodeID_<node_id>`
- `value_topic`: the topic of the value. This is manually configured by popolating a table with the values that I want to read from each device of a specific type in my network. Once scan is complete The gateway creates an array with all devices types found in the network. A device has a `device_id` that is unique, it is composed by this node properties: `<manufacturerid>-<productid>-<producttype>`.
