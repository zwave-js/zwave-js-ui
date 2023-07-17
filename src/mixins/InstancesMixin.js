import { manager, instances } from '../lib/instanceManager'
import { socketEvents } from '../../server/lib/SocketEvents'

export default {
	data() {
		return {
			bindedSocketEvents: {},
		}
	},
	computed: {
		app() {
			return manager.getInstance(instances.APP)
		},
	},
	methods: {
		bindEvent(eventName, handler) {
			this.socket.on(socketEvents[eventName], handler)
			this.bindedSocketEvents[eventName] = handler
		},
		unbindEvents() {
			for (const event in this.bindedSocketEvents) {
				this.socket.off(
					socketEvents[event],
					this.bindedSocketEvents[event]
				)
			}

			this.bindedSocketEvents = {}
		},
		async pingNode(node) {
			const response = await this.app.apiRequest('pingNode', [node.id], {
				infoSnack: true,
				errorSnack: false,
			})

			if (response.success && response.result) {
				this.showSnackbar(
					`Ping of node ${node.id} successful`,
					'success'
				)
			} else {
				this.showSnackbar(
					`Error pinging node ${node.id}: ${
						!response.success
							? response.message
							: 'no response to ping'
					}`,
					'error'
				)
			}
		},
		async healNode(node) {
			const response = await this.app.apiRequest('healNode', [node.id], {
				infoSnack: true,
				errorSnack: false,
			})

			if (response.success && response.result) {
				this.showSnackbar(
					`Heal of node ${node.id} successful`,
					'success'
				)
			} else {
				this.showSnackbar(
					`Error healing node ${node.id}: ${
						!response.success
							? response.message
							: 'failed to heal node'
					}`,
					'error'
				)
			}
		},
	},
}
