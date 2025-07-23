<template>
	<v-card-text>
		<v-form v-model="_valid">
			<v-row>
				<v-col>
					<v-text-field
						type="datetime-local"
						label="From"
						v-model="_value.from"
						:rules="rules.from"
						clearable
					></v-text-field>
					<v-text-field
						type="datetime-local"
						label="To"
						v-model="_value.to"
						:rules="rules.to"
						clearable
					></v-text-field>
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
				from: [
					(v) =>
						!v ||
						!this._value.to ||
						v <= this._value.to ||
						'From date should not be after to date',
				],
				to: [
					(v) =>
						!v ||
						!this._value.from ||
						v >= this._value.from ||
						'To date should not be before from date',
				],
			},
		}
	},
}
</script>
