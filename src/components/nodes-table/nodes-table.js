import draggable from 'vuedraggable'
import { ManagedItems } from '@/modules/ManagedItems'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'
import RichValue from '@/components/nodes-table/RichValue.vue'
import { mapGetters } from 'vuex'
import {
	mdiAlertCircle,
	mdiBatteryAlertVariantOutline,
	mdiBattery20,
	mdiBattery50,
	mdiBattery80,
	mdiBattery,
	mdiBatteryUnknown,
	mdiCheckCircle,
	mdiEmoticon,
	mdiEmoticonDead,
	mdiHelpCircle,
	mdiMinusCircle,
	mdiNumeric1Circle,
	mdiNumeric2Circle,
	mdiPlusCircle,
	mdiPowerPlug,
	mdiSleep,
} from '@mdi/js'

export default {
	props: {
		nodeActions: Array,
		socket: Object,
	},
	components: {
		draggable,
		ColumnFilter,
		ExpandedNode,
		RichValue,
	},
	watch: {},
	computed: {
		...mapGetters(['nodes']),
	},
	data: function () {
		return {
			managedNodes: null,
			nodesProps: {
				/* The node property definition map entries can have the following attributes:
           - type (string): The type of the property
           - label (string): The label of the property to be displayed as table column
           - groupable (boolean): If the column values can be grouped
           - customGroupValue (function): Function to format a value for displaying as group value
           - customSort (function): Custom sort function for a certain column.
           - customValue (function): Function to dynamically extract the value from a given node if it is not directly accessible using the key of the definition.
           - richValue (function): Function to return an object representing a value enriched with additional information (icon, label, styling) to be displayed in the table.
        */
				id: { type: 'number', label: 'ID', groupable: false },
				minBatteryLevel: {
					type: 'number',
					label: 'Power',
					customGroupValue: (group) =>
						group
							? `Battery level: ${group}%`
							: 'Mains-powered or battery level unknown',
					customSort: (items, sortBy, sortDesc, nodeA, nodeB) =>
						this.powerSort(items, sortBy, sortDesc, nodeA, nodeB),
					customValue: (node) => node.minBatteryLevel, // Note: Not required here but kept as demo for use of customValue()
					richValue: (node) => this.powerRichValue(node),
				},
				manufacturer: { type: 'string', label: 'Manufacturer' },
				productDescription: { type: 'string', label: 'Product' },
				productLabel: { type: 'string', label: 'Product code' },
				name: { type: 'string', label: 'Name' },
				loc: { type: 'string', label: 'Location' },
				security: {
					type: 'string',
					label: 'Security',
					richValue: (node) => {
						let v = {
							align: 'center',
							icon: mdiHelpCircle,
							iconStyle: 'color: grey',
							description: 'Unknown security status',
						}
						if (node.isSecure === true) {
							v.icon = mdiCheckCircle
							v.iconStyle =
								node.security === 'LOW SECURITY'
									? 'color: yellow'
									: 'color: green'
							v.description = node.security
						} else if (node.isSecure === false) {
							v.icon = mdiMinusCircle
							v.iconStyle = 'color: red'
							v.description = 'No security'
						}
						return v
					},
				},
				supportsBeaming: {
					type: 'boolean',
					label: 'Beaming',
					richValue: (node) =>
						this.booleanRichValue(node.supportsBeaming, {
							default: {
								icon: mdiHelpCircle,
								iconStyle: 'color: grey',
								description: 'Unknown beaming support',
							},
							true: {
								icon: mdiCheckCircle,
								iconStyle: 'color: green',
								description: 'Beaming is supported',
							},
							false: {
								icon: mdiMinusCircle,
								iconStyle: 'color: red',
								description: 'Beaming is unsupported',
							},
						}),
				},
				zwavePlusVersion: {
					type: 'string',
					label: 'Z-Wave+',
					richValue: (node) => {
						let v = {
							align: 'center',
							icon: node.ready ? mdiMinusCircle : mdiHelpCircle,
							iconStyle: node.ready
								? 'color: red'
								: 'color: grey',
							description: node.ready
								? 'No'
								: 'Unknown ZWave+ version',
						}
						if (node.zwavePlusVersion === undefined) return v
						v.description = `ZWave+ version: ${node.zwavePlusVersion}`
						v.iconStyle = 'color: green'
						if (node.zwavePlusVersion === 1) {
							v.icon = mdiNumeric1Circle
						} else if (node.zwavePlusVersion === 2) {
							v.icon = mdiNumeric2Circle
						} else {
							v.icon = mdiPlusCircle
							v.displayValue = `${node.zwavePlusVersion}`
						}
						return v
					},
				},
				firmwareVersion: {
					type: 'string',
					label: 'FW',
				},
				failed: {
					type: 'boolean',
					label: 'Failed',
					richValue: (node) =>
						this.booleanRichValue(node.failed, {
							default: {
								icon: mdiHelpCircle,
								iconStyle: 'color: grey',
								description: 'Failure status unknown',
							},
							true: {
								icon: mdiAlertCircle,
								iconStyle: 'color: red',
								description: 'Node is failed!',
							},
							false: {
								icon: mdiCheckCircle,
								iconStyle: 'color: green',
								description: 'Node is not failed.',
							},
						}),
				},
				status: {
					type: 'string',
					label: 'Status',
					richValue: (node) => {
						let v = {
							align: 'center',
							icon: mdiHelpCircle,
							iconStyle: 'color: grey',
							description: node.status,
						}
						switch (node.status) {
							case 'Asleep':
								v.icon = mdiSleep
								v.iconStyle = 'color: orange'
								break
							case 'Awake':
								v.icon = mdiEmoticon
								v.iconStyle = 'color: green'
								break
							case 'Dead':
								v.icon = mdiEmoticonDead
								v.iconStyle = 'color: red'
								break
							case 'Alive':
								v.icon = mdiCheckCircle
								v.iconStyle = 'color: green'
								break
						}
						return v
					},
				},
				healProgress: { type: 'string', label: 'Heal' },
				interviewStage: { type: 'string', label: 'Interview' },
				lastActive: {
					type: 'date',
					label: 'Last Active',
					groupable: false,
				},
			},
			expanded: [],
			headersMenu: false,
		}
	},
	methods: {
		toggleExpanded(item) {
			this.expanded = this.expanded.includes(item)
				? this.expanded.filter((i) => i !== item)
				: [...this.expanded, item]
		},
		getHealIcon(status) {
			switch (status) {
				case 'done':
					return { icon: 'done', color: 'green' }
				case 'failed':
					return { icon: 'error', color: 'red' }
				case 'skipped':
					return { icon: 'next_plan', color: 'blue' }
			}

			return undefined
		},
		groupValue(group) {
			return this.managedNodes.groupValue(group)
		},
		richValue(item, propName) {
			return this.managedNodes.richValue(item, propName)
		},
		sort(items, sortBy, sortDesc) {
			return this.managedNodes.sort(items, sortBy, sortDesc)
		},
		booleanRichValue(value, valueMap) {
			let map =
				value === undefined
					? valueMap.default
					: value
					? valueMap.true
					: valueMap.false
			return {
				align: 'center',
				icon: map.icon,
				iconStyle: map.iconStyle,
				description: map.description,
			}
		},
		interviewStageColor(status) {
			let map = {
				None: 'grey',
				ProtocolInfo: 'red',
				NodeInfo: 'orange',
				CommandClasses: 'orange',
				OverwriteConfig: 'blue',
				Complete: 'green',
			}
			return map[status] || 'grey'
		},
		powerRichValue(node) {
			let level = node.minBatteryLevel
			let iconStyle = 'color: green'
			let icon = ''
			let label = ''
			let description = ''
			if (node.isBatteryPowered !== undefined && !node.isBatteryPowered) {
				icon = mdiPowerPlug
				description = 'mains-powered'
			} else {
				label = `${level}%`
				description = Array.isArray(node.batteryLevels)
					? 'All battery levels: ' +
					  node.batteryLevels.map((v) => `${v}%`).join(',')
					: 'Unknown battery level'
				if (level <= 10) {
					icon = mdiBatteryAlertVariantOutline
					iconStyle = 'color: red'
				} else if (level <= 30) {
					icon = mdiBattery20
					iconStyle = 'color: orange'
				} else if (level <= 70) {
					icon = mdiBattery50
				} else if (level <= 90) {
					icon = mdiBattery80
				} else if (level > 90) {
					icon = mdiBattery
				} else {
					icon = mdiBatteryUnknown
					description = 'Battery level: unknown'
					iconStyle = 'color: grey'
					label = ''
				}
			}
			return {
				align: 'left',
				icon: icon,
				iconStyle: iconStyle,
				displayValue: label,
				displayStyle: '',
				description: description,
				rawValue: level,
			}
		},
		powerSort(items, sortBy, sortDesc, nodeA, nodeB) {
			// Special sort for power column
			let levelA = nodeA.isBatteryPowered
				? nodeA.minBatteryLevel
				: nodeA.isBatteryPowered !== undefined
				? 101
				: undefined
			let levelB = nodeB.isBatteryPowered
				? nodeB.minBatteryLevel
				: nodeB.isBatteryPowered !== undefined
				? 101
				: undefined
			let res = levelA < levelB ? -1 : levelA > levelB ? 1 : 0
			res = sortDesc[0] ? -res : res
			return res
		},
	},
	mounted() {
		this.managedNodes = new ManagedItems(
			this.nodes,
			this.nodesProps,
			localStorage,
			'nodes_'
		)
	},
}
