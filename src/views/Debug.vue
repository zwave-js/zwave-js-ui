<template>
	<v-container grid-list-md>
		<v-row>
			<v-col cols="12">
				<v-btn color="green darken-1" text @click="toggleDebug(true)"
					>Start</v-btn
				>
				<v-btn color="red darken-1" text @click="toggleDebug(false)"
					>Stop</v-btn
				>
				<v-btn color="blue darken-1" text @click="debug = []"
					>Clear</v-btn
				>

				<v-btn
					v-if="!hideTopbar"
					color="yellow darken-1"
					text
					@click="newWindow"
					>Open in window</v-btn
				>
			</v-col>

			<v-alert
				class="mb-0"
				v-if="
					!zwave.logEnabled || !gateway.logEnabled || zwave.logToFile
				"
				dense
				text
				type="warning"
			>
				<p class="ma-1" v-if="!zwave.logEnabled">
					• ZwaveJS Logs are disabled. Please enable it on "Settings >
					Z-Wave" in order to see Application logs
				</p>
				<p class="ma-1" v-if="!gateway.logEnabled">
					• Application Logs are disabled. Please enable it on
					"Settings > General" in order to see ZwaveJS logs
				</p>
				<p class="ma-1" v-if="zwave.logToFile">
					• ZwaveJS "Log to file" is enabled. Disable it in order to
					see ZwaveJS logs
				</p>
			</v-alert>

			<v-col class="pa-2" cols="12">
				<v-text-field
					style="max-width: 300px"
					label="Filter logs"
					hint="Type to filter logs, case sensitive"
					v-model="filter"
					persistent-hint
					prepend-icon="search"
				></v-text-field>
			</v-col>

			<v-col class="pt-0" cols="12">
				<div
					id="debug_window"
					style="
						height: 800px;
						width: 100%;
						overflow-y: scroll;
						border: 1px solid grey;
						padding: 10px;
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

import AnsiUp from 'ansi_up'
import { mapState, mapActions } from 'pinia'
import useBaseStore from '../stores/base.js'

const ansiUp = new AnsiUp()

const MAX_DEBUG_LINES = 500

export default {
	name: 'Debug',
	props: {
		socket: Object,
	},
	watch: {},
	computed: {
		...mapState(useBaseStore, ['zwave', 'gateway']),
		logDisabled() {
			return !this.zwave.logEnabled || !this.gateway.logEnabled
		},
		filteredLogs() {
			if (!this.filter) {
				return this.debug
			}
			return this.debug.filter((line) => {
				return line.includes(this.filter)
			})
		},
	},
	data() {
		return {
			debug: [],
			filter: '',
			debugActive: true,
			hideTopbar: false,
		}
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		toggleDebug(v) {
			this.debugActive = v
			this.showSnackbar('Debug ' + (v ? 'activated' : 'disabled'))
		},
		newWindow() {
			const newwindow = window.open(
				window.location.href + '#no-topbar',
				'DEBUG',
				'height=800,width=600,status=no,toolbar:no,scrollbars:no,menubar:no' // check https://www.w3schools.com/jsref/met_win_open.asp for all available specs
			)
			if (window.focus) {
				newwindow.focus()
			}
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
				// \b[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z\b
				this.debug.push(data)

				if (this.debug.length > MAX_DEBUG_LINES) {
					this.debug.shift()
				}

				const textarea = document.getElementById('debug_window')
				if (textarea) {
					// textarea could be hidden
					textarea.scrollTop = textarea.scrollHeight
				}
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
