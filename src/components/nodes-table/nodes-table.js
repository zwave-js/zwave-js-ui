import draggable from 'vuedraggable'
import { ManagedItems } from '@/modules/ManagedItems'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'
import RichValue from '@/components/nodes-table/RichValue.vue'
import { mapGetters } from 'vuex'
import {
	mdiBatteryAlertVariantOutline,
	mdiBattery20,
	mdiBattery50,
	mdiBattery80,
	mdiBattery,
	mdiBatteryUnknown,
	mdiPowerPlug,
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
				security: { type: 'string', label: 'Security' },
				supportsBeaming: { type: 'boolean', label: 'Beaming' },
				zwavePlusVersion: {
					type: 'string',
					label: 'Z-Wave+',
				},
				firmwareVersion: {
					type: 'string',
					label: 'FW',
				},
				failed: { type: 'boolean', label: 'Failed' },
				status: { type: 'string', label: 'Status' },
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
		powerRichValue(node) {
			let level = node.minBatteryLevel
			let iconStyle = 'color: green'
			let icon = ''
			let label = ''
			let description = ''
			if (node.powerSource === 'mains') {
				icon = mdiPowerPlug
				description = 'mains-powered'
			} else {
				label = `${level}%`
				description =
					'All battery levels: ' +
					node.batteryLevels.map((v) => `${v}%`).join(',')
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
					label = '-'
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
			let levelA =
				nodeA.powerSource === 'battery' ? nodeA.minBatteryLevel : 101
			let levelB =
				nodeB.powerSource === 'battery' ? nodeB.minBatteryLevel : 101
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
