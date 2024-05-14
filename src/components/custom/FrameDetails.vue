<template>
	<v-row>
		<v-col style="white-space: pre-wrap">
			{{ parsed }}
		</v-col>
		<v-col v-if="value && value.parsedPayload">
			<CCTreeView :value="value.parsedPayload"></CCTreeView>
		</v-col>
	</v-row>
</template>

<script>
import { jsonToList } from '../../lib/utils.js'

export default {
	props: {
		value: Object,
	},
	components: {
		CCTreeView: () => import('./CCTreeView.vue'),
	},
	data: () => ({}),
	computed: {
		parsed() {
			if (!this.value) return ''

			const ignore = ['id']
			if (this.value.parsedPayload) {
				ignore.push('parsedPayload', 'payload')
			}
			return jsonToList(this.value, { ignore })
		},
	},
	methods: {},
}
</script>

<style></style>
