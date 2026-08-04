<template>
	<!-- The directive owns one popover per host element and drops it on unmount,
		 so a row re-rendering many times per second cannot orphan tooltips (#4639) -->
	<div v-zw-tooltip:bottom="value && value.description">
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
		<ZwSpinner
			v-else-if="value && value.loading"
			:size="value.size || 24"
			label="Loading value"
		/>
	</div>
</template>

<script>
import SvgIcon from '@jamescoyle/vue-icon'
import ZwSpinner from '@/components/dashboard/atoms/ZwSpinner.vue'
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
				}
			},
		},
	},
	components: {
		ZwSpinner,
		SvgIcon,
	},
}
</script>
