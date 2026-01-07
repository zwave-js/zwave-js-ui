<template>
	<v-dialog @keydown.esc="$emit('close')" v-model="_value" max-width="800">
		<v-card>
			<v-card-title>
				<v-row class="pa-3" align="center">
					<span class="text-h5">{{ title }}</span>
					<v-spacer></v-spacer>
					<v-btn icon="close" @click="$emit('close')" />
				</v-row>
			</v-card-title>

			<v-card-text>
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
			</v-card-text>
		</v-card>
	</v-dialog>
</template>

<script>
export default {
	props: {
		modelValue: Boolean, // show or hide
		actions: Array,
		title: {
			type: String,
			default: 'Advanced',
		},
	},
	emits: ['close'],
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
	color: #999;
	line-height: 0.9rem;
}
</style>
