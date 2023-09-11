import { manager, instances } from '../lib/instanceManager'
import { socketEvents } from '@server/lib/SocketEvents.js'

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
		async rebuildNodeRoutes(node) {
			const shouldWarn =
				node.applicationRoute ||
				node.customSUCReturnRoutes?.length > 0 ||
				node.prioritySUCReturnRoute

			if (shouldWarn) {
				const confirmed = await this.app.confirm(
					'Priority/Custom return routes configured',
					`The node has priority/custom return routes configured, healing it will reset them. Are you sure you want to continue?`,
					'warning',
					{
						width: 600,
					}
				)

				if (!confirmed) {
					return
				}
			}
			const response = await this.app.apiRequest(
				'rebuildNodeRoutes',
				[node.id],
				{
					infoSnack: true,
					errorSnack: false,
				}
			)

			if (response.success && response.result) {
				this.showSnackbar(
					`Routes of node ${node.id} has been rebuilt successfully`,
					'success'
				)
			} else {
				this.showSnackbar(
					`Error while rebuilding node ${node.id} routes: ${
						!response.success
							? response.message
							: 'failed to rebuild node routes'
					}`,
					'error'
				)
			}
		},
	},
}
