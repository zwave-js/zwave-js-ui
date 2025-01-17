<template>
	<v-container grid-list-md>
		<v-row>
			<v-col style="max-width: 260px; margin-top: -2px">
				<v-btn-toggle dense multiple>
					<v-tooltip
						bottom
						v-for="button in buttons"
						:key="button.label"
						:target="`#${button.id}`"
					>
						<template v-slot:activator="{ on }">
							<v-btn
								:id="button.id"
								:color="button.color"
								:disabled="button.disabled"
								@click="button.action"
								v-on="on"
							>
								<v-icon>{{ button.icon }}</v-icon>
							</v-btn>
						</template>
						<span>{{ button.tooltip }}</span>
					</v-tooltip>
				</v-btn-toggle>
			</v-col>

			<v-col class="pa-2" cols="6">
				<v-text-field
					flat
					outlined
					dense
					single-line
					style="max-width: 300px"
					label="Filter logs"
					hint="Type to filter logs, case sensitive"
					v-model="filter"
					persistent-hint
					prepend-icon="search"
				></v-text-field>
			</v-col>

			<v-col class="pt-0 mb-5" cols="12">
				<div
					id="debug_window"
					@scroll="onScroll"
					style="
						height: 800px;
						width: 100%;
						overflow-y: scroll;
						border: 1px solid grey;
						padding: 10px;
						white-space: pre;
					"
					class="mono"
					v-html="filteredLogs.join('')"
				></div>
			</v-col>
		</v-row>
	</v-container>
</template>
<script>
import { socketEvents } from '@server/lib/SocketEvents'

import { AnsiUp } from 'ansi_up'
import { mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'
import { isPopupWindow, openInWindow } from '../lib/utils'

const ansiUp = new AnsiUp()

const MAX_DEBUG_LINES = 500

export default {
	name: 'Debug',
	props: {
		socket: Object,
	},
	watch: {},
	computed: {
		filteredLogs() {
			if (!this.filter) {
				return this.debug
			}
			return this.debug.filter((line) => {
				return line.includes(this.filter)
			})
		},
		buttons() {
			return [
				{
					id: 'start',
					label: 'Start',
					icon: 'play_arrow',
					color: 'success',
					tooltip: 'Start',
					action: () => this.toggleDebug(true),
					disabled: this.debugActive,
				},
				{
					id: 'stop',
					label: 'Stop',
					icon: 'stop',
					color: 'error',
					tooltip: 'Stop',
					action: () => this.toggleDebug(false),
					disabled: !this.debugActive,
				},
				{
					id: 'clear',
					label: 'Clear',
					icon: 'delete',
					color: 'warning',
					tooltip: 'Clear',
					action: () => (this.debug = []),
					disabled: this.debug.length === 0,
				},
				{
					id: 'open',
					label: 'Open',
					icon: 'open_in_new',
					color: 'primary',
					tooltip: 'Open in window',
					action: this.newWindow,
					disabled: isPopupWindow(),
				},
				{
					id: 'scroll',
					label: 'Scroll',
					icon: 'vertical_align_bottom',
					color: 'purple',
					tooltip: 'Enable auto scroll',
					action: this.enableAutoScroll,
					disabled: this.autoScroll,
				},
			]
		},
	},
	data() {
		return {
			debug: [],
			filter: '',
			debugActive: true,
			hideTopbar: false,
			autoScroll: true,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		toggleDebug(v) {
			this.debugActive = v
			this.showSnackbar('Debug ' + (v ? 'activated' : 'disabled'))
		},
		newWindow() {
			openInWindow('DEBUG', 1000)
		},
		enableAutoScroll() {
			this.autoScroll = true
			this.scrollBottom()
		},
		scrollBottom() {
			if (!this.autoScroll) {
				return
			}

			this.$nextTick(() => {
				const textarea = document.getElementById('debug_window')
				if (textarea) {
					// textarea could be hidden
					textarea.scrollTop = textarea.scrollHeight
				}
			})
		},
		onScroll(event) {
			// if scrolling up, disable autoscroll
			const scrollTop = event.target.scrollTop

			if (scrollTop < this.prevScrollTop) {
				this.autoScroll = false
			}
			// no need to make this reative
			this.prevScrollTop = scrollTop
		},
	},
	mounted() {
		// init socket events

		const hash = window.location.hash.substr(1)

		if (hash === 'no-topbar') {
			this.hideTopbar = true
		}

		this.socket.on(socketEvents.debug, (data) => {
			if (this.debugActive) {
				data = ansiUp.ansi_to_html(data)
				data = data.replace(/\n/g, '</br>')
				if (!data.endsWith('</br>')) {
					data += '</br>'
				}

				// remove background colors styles
				data = data.replace(/background-color:rgb\([0-9, ]+\)/g, '')
				// \b[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z\b
				this.debug.push(data)

				if (this.debug.length > MAX_DEBUG_LINES) {
					this.debug.shift()
				}

				this.scrollBottom()
			}
		})
	},
	beforeDestroy() {
		if (this.socket) {
			// unbind events
			this.socket.off(socketEvents.debug)
		}
	},
}
</script>
