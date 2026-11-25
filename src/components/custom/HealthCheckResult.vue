<template>
	<p class="mb-0">
		<template v-if="label">{{ label }}: </template>
		<em
			v-if="result.missing"
			class="text-medium-emphasis"
			v-tooltip:bottom="result.hint"
			>not measured</em
		>
		<strong
			v-else-if="result.hint"
			:class="result.color"
			v-tooltip:bottom="result.hint"
			>{{ result.text }}</strong
		>
		<strong v-else :class="result.color">{{ result.text }}</strong>
	</p>
</template>

<script>
export default {
	props: {
		label: String,
		// { text, color, hint, missing }, see DialogHealthCheck pingsResult/powerlevelResult
		result: {
			type: Object,
			required: true,
		},
	},
}
</script>
