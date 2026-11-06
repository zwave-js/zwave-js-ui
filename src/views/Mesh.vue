<template>
	<v-container class="fill" fluid>
		<div class="d-flex align-center flex-wrap ga-3 mb-2">
			<v-btn
				variant="outlined"
				prepend-icon="cell_tower"
				:loading="refreshingNeighbors"
				:disabled="neighborsCooldown > 0"
				v-tooltip:bottom="'Read every node\'s neighbor table'"
				@click="refreshNeighbors"
				>{{
					neighborsCooldown
						? `Refresh neighbors (${neighborsCooldown}s)`
						: 'Refresh neighbors'
				}}</v-btn
			>
		</div>
		<zwave-graph
			ref="mesh"
			id="mesh"
			:nodes="nodes"
			@node-click="nodeClick"
			@node-added="fetchNodeRoutes"
			@node-removed="onNodeRemoved"
		/>
		<node-panel
			v-if="$vuetify.display.mdAndUp"
			:node="selectedNode"
			:socket="socket"
			v-model="showProperties"
			id="properties"
			draggable
			class="details"
		/>

		<v-bottom-sheet scrollable v-else v-model="showProperties">
			<v-card scrollable class="text-center">
				<v-card-text>
					<node-panel
						:node="selectedNode"
						:socket="socket"
						v-model="showProperties"
					/>
				</v-card-text>
			</v-card>
		</v-bottom-sheet>
	</v-container>
</template>

<style scoped>
.details {
	position: absolute;
	top: 150px;
	left: 30px;
	background: v-bind('$vuetify.theme.current.colors.surface');
	border: 2px solid black;
	border-radius: 20px;
	max-width: 500px;
	z-index: 1;
	max-height: 80vh;
	overflow-y: scroll;
	overflow-x: hidden;
	cursor: move;
}

.details::-webkit-scrollbar {
	display: none;
}
</style>

<script>
import { defineAsyncComponent, nextTick } from 'vue'
import { mapActions, mapState } from 'pinia'
import useBaseStore from '../stores/base.js'
import InstancesMixin from '../mixins/InstancesMixin.js'

export default {
	name: 'Mesh',
	mixins: [InstancesMixin],
	props: {
		socket: Object,
	},
	components: {
		ZwaveGraph: defineAsyncComponent(
			() => import('@/components/custom/ZwaveGraph.vue'),
		),
		NodePanel: defineAsyncComponent(
			() => import('@/components/custom/NodePanel.vue'),
		),
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
	},
	documentListeners: {},
	data() {
		return {
			selectedNode: null,
			showProperties: false,
			refreshingNeighbors: false,
			// seconds until the next whole-mesh refresh is allowed
			neighborsCooldown: 0,
		}
	},
	beforeUnmount() {
		clearInterval(this.cooldownTimer)
	},
	watch: {
		showProperties(v) {
			// Return to overview map when closing the node properties dialog
			// using the X in the top right corner
			if (!v && this.selectedNode) {
				this.selectedNode = null
				this.$refs.mesh?.clearSelection()
			}
		},
	},
	methods: {
		...mapActions(useBaseStore, ['setNeighbors']),
		async refreshNeighbors() {
			const ok = await this.app.confirm(
				'Refresh neighbors',
				"Reads every node's neighbor table from the controller. The radio is off while this runs (a few seconds on most networks), and it can be done once a minute.",
				'info',
				{ confirmText: 'Refresh', width: 450 },
			)
			if (!ok) return
			this.refreshingNeighbors = true
			try {
				const res = await this.app.apiRequest('refreshNeighbors', [], {
					infoSnack: false,
					errorSnack: true,
				})
				if (res.success) {
					this.setNeighbors(res.result)
					const n = Object.keys(res.result).length
					this.showSnackbar(
						`Neighbor tables refreshed for ${n} node${n === 1 ? '' : 's'}`,
						'success',
					)
				}
			} finally {
				this.refreshingNeighbors = false
				// the server holds the lock for 60 s even when it failed
				this.startNeighborsCooldown()
			}
		},
		startNeighborsCooldown() {
			clearInterval(this.cooldownTimer)
			this.neighborsCooldown = 60
			this.cooldownTimer = setInterval(() => {
				if (--this.neighborsCooldown <= 0) {
					clearInterval(this.cooldownTimer)
				}
			}, 1000)
		},
		setInitialPosition(element) {
			const windowHeight = window.innerHeight
			const windowWidth = window.innerWidth

			const popupHeight = element.offsetHeight
			const popupWidth = element.offsetWidth

			// Set initial position (e.g., center of the window)
			let initialTop = (windowHeight - popupHeight) / 2 - 50
			let initialLeft = (windowWidth - popupWidth) / 10

			if (initialTop < 0) initialTop = 10
			if (initialLeft < 0) initialLeft = 10

			element.style.top = initialTop + 'px'
			element.style.left = initialLeft + 'px'
		},
		makeDivDraggable() {
			const elmnt = document.getElementById('properties')

			if (!elmnt) {
				return
			}

			// prevent to make it draggable multiple times
			if (elmnt.hasAttribute('data-draggable')) {
				return
			}

			elmnt.setAttribute('data-draggable', true)

			setTimeout(() => {
				this.setInitialPosition(elmnt)
			}, 100)

			let startX = 0
			let startY = 0

			elmnt.onmousedown = dragMouseDown

			function dragMouseDown(e) {
				e = e || window.event

				// return routes drag
				if (e.target.classList.contains('handle')) {
					return
				}

				e.preventDefault()

				// prevent drag when clicking on chart
				if (e.target.classList.contains('u-over')) {
					return
				}
				// get the mouse cursor position at startup:
				startX = e.clientX
				startY = e.clientY
				document.onmouseup = closeDragElement
				// call a function whenever the cursor moves:
				document.onmousemove = elementDrag
			}

			function elementDrag(e) {
				e = e || window.event
				e.preventDefault()
				// calculate the new cursor position:
				const x = startX - e.clientX
				const y = startY - e.clientY
				startX = e.clientX
				startY = e.clientY

				// set the element's new position:
				elmnt.style.top = elmnt.offsetTop - y + 'px'
				elmnt.style.left = elmnt.offsetLeft - x + 'px'
			}

			function closeDragElement() {
				/* stop moving when mouse button is released:*/
				document.onmouseup = null
				document.onmousemove = null
			}
		},
		onNodeRemoved(node) {
			if (this.selectedNode && this.selectedNode.id === node.id) {
				this.nodeClick(null)
			}
		},
		async fetchNodeRoutes(node) {
			if (!node || node.isControllerNode) return

			await Promise.allSettled([
				this.app.apiRequest('getPriorityRoute', [node.id]),
				this.app.apiRequest('getCustomSUCReturnRoute', [node.id]),
				this.app.apiRequest('getPrioritySUCReturnRoute', [node.id]),
			])
		},
		async nodeClick(node) {
			if (!node) {
				// clicked empty space — return to overview
				this.selectedNode = null
				this.showProperties = false
				return
			}

			this.selectedNode = node
			this.showProperties = true
			if (this.$vuetify.display.mdAndUp) {
				await nextTick()
				this.makeDivDraggable()
			}
		},
	},
}
</script>
