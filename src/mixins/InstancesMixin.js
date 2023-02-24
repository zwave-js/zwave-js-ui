import { manager, instances } from '../lib/instanceManager'

export default {
	computed: {
		app() {
			return manager.getInstance(instances.APP)
		},
	},
}
