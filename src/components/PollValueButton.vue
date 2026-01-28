<template>
	<v-btn
		@click="pollValue"
		v-tooltip:bottom="'Refresh this value'"
		size="x-small"
		variant="text"
		icon
		:loading="polling"
		v-bind="$attrs"
	>
		<v-icon>refresh</v-icon>
	</v-btn>
</template>

<script>
import { manager, instances } from '../lib/instanceManager'
import useBaseStore from '../stores/base.js'

export default {
	name: 'PollValueButton',
	props: {
		modelValue: {
			type: Object,
			required: true,
		},
	},
	data() {
		return {
			polling: false,
		}
	},
	methods: {
		async pollValue() {
			const app = manager.getInstance(instances.APP)

			this.polling = true

			try {
				const response = await app.apiRequest(
					'pollValue',
					[this.modelValue],
					{
						infoSnack: false,
						errorSnack: true,
					},
				)

				if (response.success) {
					useBaseStore().showSnackbar('Value refreshed', 'success')
				}
			} finally {
				this.polling = false
			}
		},
	},
}
</script>
