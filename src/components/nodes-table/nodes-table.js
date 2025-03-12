import draggable from 'vuedraggable'
import colors from 'vuetify/lib/util/colors'
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

export default {
	props: {
		socket: Object,
	},
	components: {
		draggable,
		ColumnFilter: () => import('@/components/nodes-table/ColumnFilter.vue'),
		ExpandedNode: () => import('@/components/nodes-table/ExpandedNode.vue'),
		RichValue: () => import('@/components/nodes-table/RichValue.vue'),
		StatisticsArrows: () =>
			import('@/components/custom/StatisticsArrows.vue'),
		ReinterviewBadge: () =>
			import('@/components/custom/ReinterviewBadge.vue'),
	},
	watch: {
		'managedNodes.selected': function (val) {
			this.$emit('selected', val)
		},
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
		currentTheme() {
			return this.$vuetify.theme.currentTheme
		},
	},
	data: function () {
		return {
			search: '',
			managedNodes: null,
			nodesProps: {
				/* The node property definition map entries can have the following attributes:
		   - type (string): The type of the property
		   - label (string): The label of the property to be displayed as table column
		   - groupable (boolean): If the column values can be grouped
		   - customGroupValue (function): Function to format a value for displaying as group value
		   - customSort (function): Custom sort function for a certain column.
		   - customValue (function): Function to dynamically extract the value from a given node if it is not directly accessible using the key of the definition.
		   - undefinedPlaceholder (string): The placeholder to use in filter when value is undefined.
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
						v.iconStyle = `color: ${getProtocolColor(node)}`
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
		toggleExpanded(item) {
			this.expanded = this.expanded.includes(item)
				? this.expanded.filter((i) => i !== item)
				: [...this.expanded, item]
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
		getProtocolIcon,
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
				ProtocolInfo: 'error',
				NodeInfo: 'warning',
				CommandClasses: 'warning',
				OverwriteConfig: 'primary',
				Complete: 'success',
			}
			return map[status] || 'grey'
		},
		powerRichValue(node) {
			console.log(
				'powerRichValue',
				this.$vuetify.theme.currentTheme.success,
			)
			let level = node.minBatteryLevel
			let iconStyle = `color: ${this.$vuetify.theme.currentTheme.success}`
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
		powerSort(items, sortBy, sortDesc, nodeA, nodeB) {
			// Special sort for power column
			let levelA = nodeA.isListening ? 101 : nodeA.minBatteryLevel || 0

			let levelB = nodeB.isListening ? 101 : nodeB.minBatteryLevel || 0

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
			'nodes_',
		)
	},
}
