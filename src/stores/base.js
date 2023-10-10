import { defineStore } from 'pinia'
import { $set, deepEqual } from '../lib/utils'
import logger from '../lib/logger'

import { Settings } from '@/modules/Settings'

const settings = new Settings(localStorage)

const log = logger.get('Store:Base')

const useBaseStore = defineStore('base', {
	state: () => ({
		auth: undefined,
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
			rf: {
				region: undefined,
				txPower: {
					powerlevel: undefined,
					measured0dBm: undefined,
				},
			},
			logEnabled: true,
			securityKeys: {
				S2_Unauthenticated: undefined,
				S2_Authenticated: undefined,
				S2_AccessControl: undefined,
				S0_Legacy: undefined,
			},
			deviceConfigPriorityDir: '',
			logToFile: true,
			maxFiles: 7,
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
			disableChangelog: false,
			notifyNewVersions: false,
		},
		appInfo: {
			homeid: '',
			homeHex: '',
			appVersion: '',
			zwaveVersion: '',
			serverVersion: '',
			controllerStatus: 'Unknown',
			newConfigVersion: undefined,
		},
		ui: {
			darkMode: settings.load('dark', false),
			navTabs: settings.load('navTabs', false),
			compactMode: settings.load('compact', false),
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
		// eslint-disable-next-line no-unused-vars
		updateMeshGraph(node) {
			// empty mutation, will be caught in Mesh.vue $onAction
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
					if (valueId.newValue === undefined) {
						valueId.newValue = valueId.value
					}
					node.values.splice(index, 1, valueId)
				}
			}
		},
		updateValue(data) {
			const valueId = this.getValue(data)

			if (valueId) {
				valueId.newValue = data.value
				valueId.value = data.value
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
		updateNode(n, isPartial = false) {
			let index = this.nodesMap.get(n.id)

			// we received a partial node but we don't have
			// the full node yet, so ignore it
			if (isPartial && index === undefined) {
				log.warn(
					'Received partial node info about an unknown node, skipping...',
					n
				)
				return
			}

			// when a node in included this is called multiple times:
			// - on node found event, isPartial = false
			// - on node added, isPartial = false
			// - on different interview stages updates, isPartial = true
			// - on node ready, isPartial = false

			const values = []

			// transform values object in array
			if (n.values) {
				for (const k in n.values) {
					n.values[k].newValue = n.values[k].value
					values.push(n.values[k])
				}
				n.values = values
			}

			if (index >= 0) {
				n = Object.assign(this.nodes[index], n)
			}

			n._name = n.name
				? n.name + (n.loc ? ' (' + n.loc + ')' : '')
				: 'NodeID_' + n.id

			// make them observable
			if (!n.statistics) {
				n.statistics = false
			}

			// make it observable
			if (!n.applicationRoute) {
				n.applicationRoute = false
			}

			if (!n.prioritySUCReturnRoute) {
				n.prioritySUCReturnRoute = false
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
		resetNodes() {
			// using this.nodes = [] doesn't work for reactivity
			this.nodes.splice(0, this.nodes.length)
			this.nodesMap = new Map()
		},
		initNodes(nodes) {
			this.resetNodes()
			for (let i = 0; i < nodes.length; i++) {
				this.updateNode(nodes[i])
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
			delete data.nodeId

			let emitMeshUpdate = false

			if (node) {
				let lastReceive = node.lastReceive
				let lastTransmit = node.lastTransmit
				let errorReceive = false
				let errorTransmit = false

				if (node.statistics && data.statistics) {
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

						if (
							!deepEqual(prev.lwr, cur.lwr) ||
							!deepEqual(prev.nlwr, cur.nlwr) ||
							cur.rssi != prev.rssi
						) {
							// mesh graph changed
							emitMeshUpdate = true
						}
					}
				}

				if (node.isControllerNode && data.bgRssi) {
					if (!node.bgRSSIPoints) {
						node.bgRSSIPoints = []
					}
					node.bgRSSIPoints.push(data.bgRssi)

					if (node.bgRSSIPoints.length > 360) {
						const firstPoint = node.bgRSSIPoints[0]
						const lastPoint =
							node.bgRSSIPoints[node.bgRSSIPoints.length - 1]

						const maxTimeSpan = 3 * 60 * 60 * 1000 // 3 hours

						if (
							lastPoint.timestamp - firstPoint.timestamp >
							maxTimeSpan
						) {
							node.bgRSSIPoints.shift()
						}
					}
				}

				const routeUpdated = (prop) => {
					return (
						data[prop] === false ||
						(data[prop] !== undefined &&
							!deepEqual(data[prop], node[prop]))
					)
				}

				if (
					!emitMeshUpdate &&
					(routeUpdated('applicationRoute') ||
						routeUpdated('prioritySUCReturnRoute') ||
						routeUpdated('customSUCReturnRoutes'))
				) {
					// mesh graph changed
					emitMeshUpdate = true
				}

				if (emitMeshUpdate) {
					this.updateMeshGraph(node)
				}

				Object.assign(node, {
					...data,
					lastReceive,
					lastTransmit,
					errorReceive,
					errorTransmit,
				})
			}
		},
		setRebuildRoutesProgress(nodesProgress) {
			for (const [nodeId, progress] of nodesProgress) {
				const node = this.getNode(nodeId)
				if (node) {
					$set(node, 'rebuildRoutesProgress', progress)
				}
			}
		},
		initSettings(conf) {
			if (conf) {
				Object.assign(this.zwave, conf.zwave || {})
				if (!this.zwave.rf) {
					this.zwave.rf = {}
				}

				if (!this.zwave.rf.txPower) {
					this.zwave.rf.txPower = {}
				}
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
		setCompactMode(value) {
			settings.store('compact', value)
			this.ui.compactMode = value
		},
	},
})

export default useBaseStore
