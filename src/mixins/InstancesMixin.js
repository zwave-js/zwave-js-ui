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
	},
}
