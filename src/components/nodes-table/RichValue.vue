<template>
	<div>
		<!--
			Use the component form (not v-tooltip directive) so the overlay tracks
			the parent's mount lifecycle. On chatty meshes the row re-renders many
			times per second; the directive form leaks orphan tooltips (see #4639).
			The open-delay also keeps transient mouse-overs from triggering at all.
		-->
		<v-tooltip
			v-if="value && value.description"
			activator="parent"
			location="bottom"
			:open-delay="300"
		>
			{{ value.description }}
		</v-tooltip>
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
				}
			},
		},
	},
	components: {
		SvgIcon,
	},
}
</script>
