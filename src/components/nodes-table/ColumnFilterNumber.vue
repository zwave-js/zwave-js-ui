<template>
	<v-card-text>
		<v-form v-model="_valid">
			<v-row>
				<v-col>
					<v-text-field
						type="number"
						label="Min"
						v-model="_value.min"
						:rules="rules.min"
						clearable
					></v-text-field>
				</v-col>
				<v-col>
					<v-text-field
						type="number"
						label="Max"
						v-model="_value.max"
						:rules="rules.max"
						clearable
					></v-text-field>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<v-select
						v-model="values"
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
			default: () => ColumnFilterHelper.defaultFilter('number'),
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
		values: {
			get() {
				const undefinedPlaceholder = this.items.find(
					(i) => typeof i === 'string',
				)

				if (undefinedPlaceholder) {
					return (
						this._value.values?.map((v) =>
							v === undefined ? undefinedPlaceholder : v,
						) ?? []
					)
				} else {
					return this._value.values ?? []
				}
			},
			set(v) {
				this._value.values = v
			},
		},
	},
	data() {
		return {
			rules: {
				min: [
					(v) => !v || v >= 0 || 'Minimum should not be negative',
					(v) =>
						!v ||
						!this._value.max ||
						v <= this._value.max ||
						'Minimum should not be above maximum',
				],
				max: [
					(v) => !v || v >= 0 || 'Maximum should not be negative',
					(v) =>
						!v ||
						!this._value.min ||
						v >= this._value.min ||
						'Maximum should not be below minimum',
				],
			},
		}
	},
}
</script>
