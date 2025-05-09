<template>
	<v-container class="fill" fluid>
		<zwave-graph
			ref="mesh"
			id="mesh"
			:nodes="nodes"
			@node-click="nodeClick"
		/>

		<!-- <v-speed-dial style="left: 100px" bottom fab left fixed v-model="fab">
			<template v-slot:activator>
				<v-btn color="primary" dark fab hover v-model="fab">
					<v-icon v-if="fab">close</v-icon>
					<v-icon v-else>add</v-icon>
				</v-btn>
			</template>
			<v-btn fab dark small color="success" @click="debounceRefresh">
				<v-icon>refresh</v-icon>
			</v-btn>
		</v-speed-dial> -->

		<!-- <v-overlay
			:style="{
				color: $vuetify.theme.dark ? 'white' : 'black',
				backgroundColor: $vuetify.theme.dark ? 'black' : 'white',
			}"
			opacity="0"
			z-index="9999"
			v-if="showFullscreen"
		>
			<v-btn
				style="position: absolute; top: 10px; right: 10px"
				icon
				large
				:color="$vuetify.theme.dark ? 'white' : 'black'"
				@click="showFullscreen = false"
			>
				<v-icon>close</v-icon>
			</v-btn>
			<bg-rssi-chart :node="selectedNode" fill-size />
		</v-overlay> -->

		<node-panel
			v-if="$vuetify.breakpoint.mdAndUp"
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
	background: #ccccccaa;
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
		ZwaveGraph: () => import('@/components/custom/ZwaveGraph.vue'),
		NodePanel: () => import('@/components/custom/NodePanel.vue'),
	},
	computed: {
		...mapState(useBaseStore, ['nodes']),
	},
	documentListeners: {},
	data() {
		return {
			// fab: false,
			selectedNode: null,
			showProperties: false,
			// refreshTimeout: null,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar', 'setNeighbors']),
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
		async nodeClick(node) {
			this.selectedNode = this.selectedNode === node ? null : node
			this.showProperties = !!this.selectedNode
			if (this.$vuetify.breakpoint.mdAndUp && this.showProperties) {
				await this.$nextTick()
				this.makeDivDraggable()
			}
		},
		debounceRefresh() {
			if (this.refreshTimeout) {
				clearTimeout(this.refreshTimeout)
			}

			this.refreshTimeout = setTimeout(this.refresh.bind(this), 500)
		},
		async refresh() {
			const response = await this.app.apiRequest('refreshNeighbors', [], {
				infoSnack: false,
				errorSnack: false, // prevent to show error
			})

			if (response.success) {
				this.showSnackbar('Nodes Neighbors updated', 'success')
				this.setNeighbors(response.result)
			}
		},
	},
	mounted() {
		this.debounceRefresh()
	},
	beforeDestroy() {
		if (this.refreshTimeout) {
			clearTimeout(this.refreshTimeout)
		}
	},
}
</script>
