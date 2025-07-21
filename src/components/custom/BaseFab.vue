<template>
	<v-fab :location="location" :color="color" app icon :size="size">
		<v-icon color="white">{{ _value ? iconClose : iconOpen }}</v-icon>

		<v-speed-dial
			v-model="_value"
			:location="direction"
			activator="parent"
			:attach="true"
			:transition="transition"
		>
			<v-btn
				v-for="(item, i) in items.filter((x) => !x.hide)"
				v-tooltip="{
					disabled: !item.tooltip,
					text: item.tooltip,
					location: item.left
						? 'left'
						: item.right
							? 'right'
							: undefined,
				}"
				variant="flat"
				:key="i"
				:icon="item.icon"
				:color="item.color"
				:size="
					$vuetify.display.mdAndUp
						? 'small'
						: $vuetify.display.smAndDown
							? 'x-small'
							: undefined
				"
				@click.stop="item.action"
			/>
		</v-speed-dial>
	</v-fab>
</template>

<script>
export default {
	props: {
		modelValue: Boolean,
		size: { type: String, default: 'large' },
		location: { type: String, default: 'right bottom' },
		direction: { type: String, default: 'top center' },
		items: { type: Array, default: () => [] },
		color: { type: String, default: 'primary' },
		iconOpen: { type: String, default: 'mdi-plus' },
		iconClose: { type: String, default: 'mdi-close' },
		transition: { type: [String, Boolean], default: 'fade-transition' },
		small: Boolean,
	},
	emits: ['update:modelValue'],
	computed: {
		_value: {
			get() {
				return this.modelValue
			},
			set(val) {
				this.$emit('update:modelValue', val)
			},
		},
	},
}
</script>
