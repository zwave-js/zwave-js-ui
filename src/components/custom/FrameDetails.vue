<template>
	<v-row>
		<v-col style="white-space: pre-wrap" class="ma-2">
			{{ parsed }}
		</v-col>
		<v-col v-if="value.parsedPayload" class="ma-2">
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
			return jsonToList(this.value, { ignore: ['parsedPayload', 'id'] })
		},
	},
	methods: {},
}
</script>

<style></style>
