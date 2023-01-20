import { defineStore } from 'pinia'
import { $set } from '../lib/utils'

import { Settings } from '@/modules/Settings'

const settings = new Settings(localStorage)

const useBaseStore = defineStore('base', {
	state: () => ({
		auth: undefined,
		nodesManagerOpen: false,
		controllerId: undefined,
		serial_ports: [],
		scales: [],
		nodes: [],
		nodesMap: new Map(),
		user: {},
		zwave: {
			port: '/dev/zwave',
			allowBootloaderOnly: false,
			commandsTimeout: 30,
			logLevel: 'debug',
			logEnabled: true,
			securityKeys: {
				S2_Unauthenticated: undefined,
				S2_Authenticated: undefined,
				S2_AccessControl: undefined,
				S0_Legacy: undefined,
			},
			deviceConfigPriorityDir: '',
			logToFile: true,
			serverEnabled: false,
			serverServiceDiscoveryDisabled: false,
			enableSoftReset: true,
			enableStatistics: undefined, // keep it undefined so the user dialog will show up
			serverPort: 3000,
			serverHost: undefined,
			maxNodeEventsQueueSize: 100,
			higherReportsTimeout: false,
		},
		backup: {
			storeBackup: false,
			storeCron: '0 0 * * *',
			storeKeep: 7,
			nvmBackup: false,
			nvmBackupOnEvent: false,
			nvmCron: '0 0 * * *',
			nvmKeep: 7,
		},
		mqtt: {
			name: 'zwave-js-ui',
			host: 'localhost',
			port: 1883,
			qos: 1,
			prefix: 'zwave',
			reconnectPeriod: 3000,
			retain: true,
			clean: true,
			auth: false,
			username: undefined,
			password: undefined,
		},
		devices: [],
		gateway: {
			type: 0,
			plugins: [],
			authEnabled: false,
			payloadType: 0,
			nodeNames: true,
			hassDiscovery: false,
			discoveryPrefix: 'homeassistant',
			logEnabled: false,
			logLevel: 'debug',
			logToFile: false,
			values: [],
			jobs: [],
		},
		appInfo: {
			homeid: '',
			homeHex: '',
			appVersion: '',
			zwaveVersion: '',
			controllerStatus: 'Unknown',
			newConfigVersion: undefined,
		},
		ui: {
			darkMode: settings.load('dark', false),
			navTabs: settings.load('navTabs', false),
		},
	}),
	getters: {
		controllerNode() {
			return this.controllerId ? this.getNode(this.controllerId) : null
		},
	},
	actions: {
		getNode(id) {
			if (typeof id === 'string') {
				id = parseInt(id)
			}

			return this.nodes[this.nodesMap.get(id)]
		},
		getValue(v) {
			const node = this.getNode(v.nodeId)

			if (node && node.values) {
				return node.values.find((i) => i.id === v.id)
			} else {
				return null
			}
		},
		// eslint-disable-next-line no-unused-vars
		showSnackbar(text, color = 'info', timeout = 3000) {
			// empty mutation, will be caught in App.vue $onAction
		},
		setUser(data) {
			Object.assign(this.user, data)
		},
		setControllerStatus(data) {
			this.appInfo.controllerStatus = data
		},
		setAppInfo(data) {
			this.appInfo.homeid = data.homeid
			this.appInfo.homeHex = data.name
			this.appInfo.appVersion = data.appVersion
			this.appInfo.zwaveVersion = data.zwaveVersion
			this.appInfo.serverVersion = data.serverVersion
			this.appInfo.newConfigVersion = data.newConfigVersion
		},
		setValue(valueId) {
			const toReplace = this.getValue(valueId)
			const node = this.getNode(valueId.nodeId)

			if (node && toReplace) {
				const index = node.values.indexOf(toReplace)
				if (index >= 0) {
					node.values.splice(index, 1, valueId)
				}
			}
		},
		updateValue(data) {
			const valueId = this.getValue(data)

			if (valueId) {
				valueId.newValue = data.value
				valueId.value = data.value

				if (valueId.toUpdate) {
					this.showSnackbar('Value updated', 'success')
					valueId.toUpdate = false
				}
			} else {
				// means that this value has been added
				const node = this.getNode(data.nodeId)
				if (node) {
					data.newValue = data.value
					node.values.push(data)
				}
			}
		},
		removeValue(data) {
			const valueId = this.getValue(data)
			if (valueId) {
				const node = this.getNode(data.nodeId)
				const index = node.values.indexOf(valueId)

				if (index >= 0) {
					node.values.splice(index, 1)
				}
			}
		},
		initNode(n) {
			const values = []
			// transform object in array

			if (n.values) {
				for (const k in n.values) {
					n.values[k].newValue = n.values[k].value
					values.push(n.values[k])
				}
				n.values = values
			}

			let index = this.nodesMap.get(n.id)

			if (index >= 0) {
				n = Object.assign(this.nodes[index], n)
			}

			n._name = n.name
				? n.name + (n.loc ? ' (' + n.loc + ')' : '')
				: 'NodeID_' + n.id

			// prevent empty stats on startup
			if (!n.statistics) {
				n.statistics = false
			}

			if (n.isControllerNode) {
				this.controllerId = n.id
			}

			if (index >= 0) {
				this.nodes.splice(index, 1, n)
			} else {
				this.nodes.push(n)
				this.nodesMap.set(n.id, this.nodes.length - 1)
			}
		},
		initNodes(nodes) {
			for (let i = 0; i < nodes.length; i++) {
				this.initNode(nodes[i])
			}
		},
		removeNode(n) {
			const index = this.nodesMap.get(n.id)

			if (index >= 0) {
				this.nodesMap.delete(n.id)
				this.nodes.splice(index, 1)
			}
		},
		setNeighbors(neighbors) {
			for (const nodeId in neighbors) {
				const node = this.getNode(nodeId)
				if (node) {
					$set(node, 'neighbors', neighbors[nodeId])
				}
			}
		},
		addNodeEvent(data) {
			const node = this.getNode(data.nodeId)
			if (node) {
				node.eventsQueue.push(data.event)
				while (
					node.eventsQueue.length > this.zwave.maxNodeEventsQueueSize
				) {
					node.eventsQueue.shift()
				}
			}
		},
		setStatistics(data) {
			const node = this.getNode(data.nodeId)
			if (node) {
				let lastReceive = node.lastReceive
				let lastTransmit = node.lastTransmit
				let errorReceive = false
				let errorTransmit = false

				if (node.statistics) {
					if (node.isControllerNode) {
						const prev = node.statistics
						const cur = data.statistics

						// Check for changes on the TX side
						if (
							prev.NAK < cur.NAK ||
							prev.messagesDroppedTX < cur.messagesDroppedTX ||
							prev.timeoutACK < cur.timeoutACK ||
							prev.timeoutResponse < cur.timeoutResponse ||
							prev.timeoutCallback < cur.timeoutCallback
						) {
							//There was an error transmitting
							errorTransmit = true
							lastTransmit = data.lastActive
						} else if (prev.messagesTX < cur.messagesTX) {
							// A message was sent
							errorTransmit = false
							lastTransmit = data.lastActive
						}

						// Check for changes on the RX side
						if (prev.messagesDroppedRX < cur.messagesDroppedRX) {
							//There was an error receiving
							errorReceive = true
							lastReceive = data.lastActive
						} else if (prev.messagesRX < cur.messagesRX) {
							// A message was received
							errorReceive = false
							lastReceive = data.lastActive
						}
					} else {
						const prev = node.statistics
						const cur = data.statistics

						// Check for changes on the TX side
						if (
							prev.commandsDroppedTX < cur.commandsDroppedTX ||
							prev.timeoutResponse < cur.timeoutResponse
						) {
							//There was an error transmitting
							errorTransmit = true
							lastTransmit = data.lastActive
						} else if (prev.commandsTX < cur.commandsTX) {
							// A message was sent
							errorTransmit = false
							lastTransmit = data.lastActive
						}

						// Check for changes on the RX side
						if (prev.commandsDroppedRX < cur.commandsDroppedRX) {
							//There was an error receiving
							errorReceive = true
							lastReceive = data.lastActive
						} else if (prev.commandsRX < cur.commandsRX) {
							// A message was received
							errorReceive = false
							lastReceive = data.lastActive
						}
					}
				}

				Object.assign(node, {
					statistics: data.statistics,
					lastActive: data.lastActive,
					lastReceive,
					lastTransmit,
					errorReceive,
					errorTransmit,
				})
			}
		},
		setHealProgress(nodesProgress) {
			for (const [nodeId, progress] of nodesProgress) {
				const node = this.getNode(nodeId)
				if (node) {
					$set(node, 'healProgress', progress)
				}
			}
		},
		initSettings(conf) {
			if (conf) {
				Object.assign(this.zwave, conf.zwave || {})
				Object.assign(this.mqtt, conf.mqtt || {})
				Object.assign(this.gateway, conf.gateway || {})
				Object.assign(this.backup, conf.backup || {})
			}
		},
		initPorts(ports) {
			if (ports) {
				this.serial_ports = ports || []
			}
		},
		initScales(scales) {
			if (scales) {
				this.scales = scales || []
			}
		},
		initDevices(devices) {
			if (!this.gateway.values) this.gateway.values = []

			if (devices) {
				// devices is an object where key is the device ID and value contains
				// device information
				for (const k in devices) {
					const d = devices[k]
					d.value = k

					const values = []

					// device.values is an object where key is the valueID (cmdClass-instance-index) and value contains
					// value information
					for (const id in d.values) {
						const val = d.values[id]
						values.push(val)
					}

					d.values = values

					this.devices.push(d)
				}
			}
		},
		init(data) {
			if (data) {
				this.initSettings(data.settings)
				this.initPorts(data.serial_ports)
				this.initScales(data.scales)
				this.initDevices(data.devices)
			}
		},
		setDarkMode(value) {
			settings.store('dark', value)
			this.ui.darkMode = value
		},
		setNavTabs(value) {
			settings.store('navTabs', value)
			this.ui.navTabs = value
		},
	},
})

export default useBaseStore
