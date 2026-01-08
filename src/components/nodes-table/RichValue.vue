<template>
	<div
		v-tooltip:bottom="value.description"
		:style="value.onClick ? 'cursor: pointer;' : ''"
		@click="handleClick"
	>
		<span
			v-if="value !== undefined && value.icon === ''"
			:style="'padding-top: 4px; ' + value.displayStyle"
			>{{ value.displayValue }}</span
		>
		<v-layout
			v-if="value !== undefined && value.icon !== ''"
			:label="value.description"
			:justify-start="value.align === 'left'"
			:justify-center="value.align === 'center'"
			:justify-end="value.align === 'right'"
			style="z-index: unset"
		>
			<svg-icon
				type="mdi"
				:path="value.icon"
				:size="value.size || 24"
				:style="value.iconStyle"
			></svg-icon>
			<span
				v-if="value !== undefined && !!value.displayValue"
				:style="'padding-top: 4px; ' + value.displayStyle"
				>{{ value.displayValue }}</span
			>
		</v-layout>
		<v-progress-circular
			v-else-if="value && value.loading"
			color="primary"
			:size="value.size || 24"
			indeterminate
		></v-progress-circular>
	</div>
</template>

<script>
import SvgIcon from '@jamescoyle/vue-icon'
export default {
	props: {
		value: {
			type: Object,
			required: true,
			default: () => {
				return {
					align: 'left',
					icon: '',
					size: 24,
					iconStyle: '',
					displayValue: '',
					displayStyle: '',
					description: '',
					rawValue: undefined,
					onClick: null,
				}
			},
		},
	},
	components: {
		SvgIcon,
	},
	methods: {
		handleClick() {
			if (this.value.onClick) {
				this.value.onClick()
			}
		},
	},
}
</script>
