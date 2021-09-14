import draggable from 'vuedraggable'
import { ManagedItems } from '@/modules/ManagedItems'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'
import { mapGetters } from 'vuex'
import SvgIcon from '@jamescoyle/vue-icon'
import {
	mdiBatteryAlertVariantOutline,
	mdiBattery20,
	mdiBattery50,
	mdiBattery80,
	mdiBattery,
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
		SvgIcon,
	},
	watch: {},
	computed: {
		...mapGetters(['nodes']),
	},
	data: function () {
		return {
			managedNodes: null,
			nodesProps: {
				id: { type: 'number', label: 'ID', groupable: false },
				power: {
					type: 'number',
					label: 'Power',
					valueFn: (node) => this.getBatteryLevel(node),
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
		customSort(items, sortBy, sortDesc) {
			// See https://stackoverflow.com/a/54612408
			if (!sortBy[0]) {
				return items
			}
			items.sort((a, b) => {
				let prop = sortBy[0]
				if (prop === 'power') {
					// Special sort for power column
					// Use 100% as fallback (for mains-powered devices)
					let levelA = this.getBatteryLevel(a, 100)
					let levelB = this.getBatteryLevel(b, 100)
					let res = levelA < levelB ? -1 : levelA > levelB ? 1 : 0
					res = sortDesc[0] ? -res : res
					return res
				} else {
					// Standard sort for every other column
					let res = a[prop] < b[prop] ? -1 : a[prop] > b[prop] ? 1 : 0
					res = sortDesc[0] ? -res : res
					return res
				}
			})
			return items
		},
		getBatteryLevel(node, fallback) {
			// TODO: This has been taken from ZwaveGraph.vue method listNodes() and should be made reusable.
			let batlev

			if (node.values) {
				batlev = node.values.find(
					(v) => v.commandClass === 128 && v.property === 'level'
				)
			}

			batlev = batlev ? batlev.value : undefined
			return batlev !== undefined ? batlev : fallback
		},
		getPowerInfo(node) {
			let level = this.getBatteryLevel(node)
			let style = 'color: green'
			let icon
			let label = level + '%'
			let tooltip = 'Battery level: ' + level + '%'
			if (level === undefined) {
				icon = mdiPowerPlug
				label = ''
				tooltip = 'mains-powered'
			} else if (level <= 10) {
				icon = mdiBatteryAlertVariantOutline
				style = 'color: red'
			} else if (level <= 30) {
				icon = mdiBattery20
				style = 'color: orange'
			} else if (level <= 70) {
				icon = mdiBattery50
			} else if (level <= 90) {
				icon = mdiBattery80
			} else {
				icon = mdiBattery
			}
			return {
				icon: icon,
				level: level,
				style: style,
				label: label,
				tooltip: tooltip,
			}
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
