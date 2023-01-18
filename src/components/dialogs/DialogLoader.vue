<template>
	<v-dialog v-model="value" persistent width="500">
		<v-card>
			<v-card-title v-if="title">
				<span class="headline">{{ title }}</span>
			</v-card-title>
			<v-card-text :class="{ 'pt-5': !title }" class="text-center">
				{{ text }}
				<v-progress-linear
					:value="progress"
					:indeterminate="progress === -1"
					class="mt-1"
				>
				</v-progress-linear>
				<span v-if="progress !== -1">{{ progress }}%</span>
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
export default {
	props: {
		value: {
			type: Boolean,
			default: false,
		},
		title: {
			type: String,
			default: 'Loading',
		},
		text: {
			type: String,
			default: 'Please wait',
		},
		progress: {
			type: Number,
			default: -1,
		},
	},
}
</script>
