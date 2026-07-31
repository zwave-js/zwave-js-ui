<template>
	<ZwDialog
		:model-value="_value"
		size="lg"
		:title="title"
		@update:model-value="_value = $event"
		@close="$emit('close')"
	>
		<div :class="['action-grid', $vuetify.display.name]">
			<div v-for="(a, i) in actions" :key="i">
				<v-icon :color="a.color || 'primary'" size="x-large">{{
					a.icon
				}}</v-icon>
				<div style="font-size: 1.1rem">{{ a.text }}</div>
				<div class="action-desc">{{ a.desc }}</div>
				<v-btn
					v-for="(o, i) in a.options"
					:key="i"
					@click="$emit('action', o.action, o.args)"
					variant="text"
					:color="a.color || 'primary'"
					>{{ o.name }}</v-btn
				>
			</div>
		</div>
	</ZwDialog>
</template>

<script>
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'

export default {
	components: { ZwDialog },
	props: {
		modelValue: Boolean, // show or hide
		actions: Array,
		title: {
			type: String,
			default: 'Advanced',
		},
	},
	emits: ['update:modelValue', 'close', 'action'],
	data() {
		return {}
	},
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
	methods: {},
}
</script>

<style scoped>
.action-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	column-gap: 1.4rem;
	row-gap: 1.2rem;
	justify-items: center;
	align-items: center;
}
.action-grid.xs {
	grid-template-columns: repeat(1, 1fr);
}
.action-grid.sm {
	grid-template-columns: repeat(2, 1fr);
	column-gap: 1rem;
}
.action-grid > div {
	text-align: center;
	max-width: 215px;
}
.action-desc {
	font-size: 0.7rem;
	color: var(--zw-muted);
	line-height: 0.9rem;
}
</style>
