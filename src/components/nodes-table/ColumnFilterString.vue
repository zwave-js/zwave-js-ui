<template>
	<v-card-text>
		<v-form v-model="_valid">
			<v-row>
				<v-col>
					<v-text-field
						label="Search"
						hint="Supports regular expressions"
						v-model="_value.match"
						:rules="rules.match"
						clearable
					></v-text-field>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<v-select
						v-model="_value.values"
						:items="items"
						label="Values"
						clearable
						chips
						closable-chips
						density="compact"
						multiple
					></v-select>
				</v-col>
			</v-row>
		</v-form>
	</v-card-text>
</template>

<script>
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'
export default {
	props: {
		modelValue: {
			type: Object,
			default: () => ColumnFilterHelper.defaultFilter('string'),
			required: true,
		},
		valid: {
			type: Boolean,
			default: false,
			required: false,
		},
		items: {
			type: Array,
			default: () => [],
			required: true,
		},
	},
	computed: {
		_value: {
			get() {
				return this.modelValue
			},
			set(v) {
				this.$emit('update:modelValue', v)
			},
		},
		_valid: {
			get() {
				return this.valid
			},
			set(v) {
				this.$emit('update:valid', v)
			},
		},
	},
	data() {
		return {
			rules: {
				match: [(v) => this.validateRegex(v)],
			},
		}
	},
	methods: {
		validateRegex(rex) {
			let res
			try {
				res = !!new RegExp(rex)
			} catch (e) {
				res = e.message
			}
			return res
		},
	},
}
</script>
