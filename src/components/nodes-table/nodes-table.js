import draggable from 'vuedraggable'
import colors from 'vuetify/util/colors'
import { ManagedItems } from '@/modules/ManagedItems'

import { mapState } from 'pinia'
import {
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
	mdiZWave,
} from '@mdi/js'
import useBaseStore from '../../stores/base.js'
import {
	getBatteryDescription,
	getProtocolIcon,
	getProtocol,
	getProtocolColor,
} from '../../lib/utils.js'
import { instances, manager } from '../../lib/instanceManager.js'
import { defineAsyncComponent } from 'vue'

export default {
	props: {
		socket: Object,
	},
	components: {
		draggable,
		ColumnFilter: defineAsyncComponent(
			() => import('@/components/nodes-table/ColumnFilter.vue'),
		),
		ExpandedNode: defineAsyncComponent(
			() => import('@/components/nodes-table/ExpandedNode.vue'),
		),
		RichValue: defineAsyncComponent(
			() => import('@/components/nodes-table/RichValue.vue'),
		),
		StatisticsArrows: defineAsyncComponent(
			() => import('@/components/custom/StatisticsArrows.vue'),
		),
		ReinterviewBadge: defineAsyncComponent(
			() => import('@/components/custom/ReinterviewBadge.vue'),
		),
		FirmwareUpdateBadge: defineAsyncComponent(
			() => import('@/components/custom/FirmwareUpdateBadge.vue'),
		),
	},
	watch: {
		'managedNodes.selected': function (val) {
			this.$emit('selected', val)
		},
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		app() {
			return manager.getInstance(instances.APP)
		},
		currentTheme() {
			return this.app.currentTheme
		},
	},
	data: function () {
		return {
			search: '',
			managedNodes: null,
			nodesProps: {
				id: { type: 'number', label: 'ID', groupable: false },
				minBatteryLevel: {
					type: 'number',
					label: 'Power',
					customGroupValue: (group) =>
						group
							? `Battery level: ${group}%`
							: 'Mains-powered or battery level unknown',
					customSort: (sortDesc, nodeA, nodeB) =>
						this.powerSort(sortDesc, nodeA, nodeB),
					customValue: (node) => node.minBatteryLevel, // Note: Not required here but kept as demo for use of customValue()
					richValue: (node) => this.powerRichValue(node),
					undefinedPlaceholder: 'Mains', // must match the text of undefined value
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
							iconStyle: `color: ${colors.grey.base}`,
							description: 'Unknown security status',
						}
						if (node.isSecure === true) {
							v.icon = mdiCheckCircle
							v.iconStyle =
								node.security === 'S0_Legacy'
									? `color: ${this.currentTheme.warning}`
									: `color: ${this.currentTheme.success}`
							v.description = node.security
						} else if (node.isSecure === false) {
							v.icon = mdiMinusCircle
							v.iconStyle = `color: ${this.currentTheme.error}`
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
								iconStyle: `color: ${colors.grey.base}`,
								description: 'Unknown beaming support',
							},
							true: {
								icon: mdiCheckCircle,
								iconStyle: `color: ${this.currentTheme.success}`,
								description: 'Beaming is supported',
							},
							false: {
								icon: mdiMinusCircle,
								iconStyle: `color: ${this.currentTheme.error}`,
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
								? `color: ${this.currentTheme.error}`
								: 'color: grey',
							description: node.ready
								? 'No'
								: 'Unknown ZWave+ version',
						}
						if (node.zwavePlusVersion === undefined) return v
						v.description = `ZWave+ version: ${node.zwavePlusVersion}`
						v.iconStyle = `color: ${this.currentTheme.success}`
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
				protocol: {
					type: 'string',
					label: 'Protocol',
					richValue: (node) => {
						let v = {
							align: 'center',
							icon: node.ready ? mdiMinusCircle : mdiHelpCircle,
							iconStyle: node.ready
								? `color: ${this.currentTheme.error}`
								: 'color: grey',
							description: node.ready ? 'No' : 'Unknown Protocol',
						}
						if (node.protocol === undefined) return v

						v.icon = mdiZWave
						v.description = getProtocol(node)
						v.iconStyle = `color: ${getProtocolColor(node, this.currentTheme)}`
						return v
					},
				},
				firmwareVersion: {
					type: 'string',
					label: 'FW',
				},
				status: {
					type: 'string',
					label: 'Status',
					richValue: (node) => {
						let v = {
							align: 'center',
							icon: mdiHelpCircle,
							iconStyle: `color: ${colors.grey.base}`,
							description: node.status,
						}
						switch (node.status) {
							case 'Asleep':
								v.icon = mdiSleep
								v.iconStyle = `color: ${this.currentTheme.warning}`
								break
							case 'Awake':
								v.icon = mdiEmoticon
								v.iconStyle = `color: ${this.currentTheme.success}`
								break
							case 'Dead':
								v.icon = mdiEmoticonDead
								v.iconStyle = `color: ${this.currentTheme.error}`
								break
							case 'Alive':
								v.icon = mdiCheckCircle
								v.iconStyle = `color: ${this.currentTheme.success}`
								break
						}
						return v
					},
				},
				rebuildRoutesProgress: {
					type: 'string',
					label: 'Rebuild routes',
				},
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
		getProgress(node) {
			return node.firmwareUpdate
				? Math.round(
						(node.firmwareUpdate.sentFragments /
							node.firmwareUpdate.totalFragments) *
							100,
					)
				: null
		},
		getRebuildRoutesIcon(status) {
			switch (status) {
				case 'done':
					return { icon: 'done', color: 'success' }
				case 'failed':
					return { icon: 'error', color: 'error' }
				case 'skipped':
					return { icon: 'next_plan', color: 'primary' }
			}

			return undefined
		},
		getProtocolIcon(protocol) {
			return getProtocolIcon(protocol, this.currentTheme)
		},
		groupValue(group) {
			return this.managedNodes.groupValue(group.value)
		},
		richValue(item, propName) {
			return this.managedNodes.richValue(item, propName)
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
				ProtocolInfo: 'error',
				NodeInfo: 'warning',
				CommandClasses: 'warning',
				OverwriteConfig: 'primary',
				Complete: 'success',
			}
			return map[status] || 'grey'
		},
		powerRichValue(node) {
			let level = node.minBatteryLevel
			let iconStyle = `color: ${this.currentTheme.success}`
			let icon = ''
			let label = ''
			let description = ''
			if (node.isListening) {
				icon = mdiPowerPlug
				description = 'mains-powered'
			} else {
				label = `${level}%`
				description = getBatteryDescription(node)
				if (level <= 10) {
					icon = mdiBatteryAlertVariantOutline
					iconStyle = `color: ${this.currentTheme.error}`
				} else if (level <= 30) {
					icon = mdiBattery20
					iconStyle = `color: ${this.currentTheme.warning}`
				} else if (level <= 70) {
					icon = mdiBattery50
				} else if (level <= 90) {
					icon = mdiBattery80
				} else if (level > 90) {
					icon = mdiBattery
				} else {
					icon = mdiBatteryUnknown
					description = 'Battery level: unknown'
					iconStyle = `color: ${colors.grey.base}`
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
		powerSort(sortDesc, nodeA, nodeB) {
			// Special sort for power column
			let levelA = nodeA.isListening ? 101 : nodeA.minBatteryLevel || 0

			let levelB = nodeB.isListening ? 101 : nodeB.minBatteryLevel || 0

		let res = levelA < levelB ? -1 : levelA > levelB ? 1 : 0
		res = sortDesc ? -res : res
		return res
		},
		openNodeFirmwareTab(nodeId) {
			// Emit event to parent to open the specific node's firmware tab
			this.$emit('open-node-firmware-tab', nodeId)
		},
	},
	mounted() {
		this.managedNodes = new ManagedItems(
			this.nodes,
			this.nodesProps,
			localStorage,
			'nodes_',
		)
	},
}
