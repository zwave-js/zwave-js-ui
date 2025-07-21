<template>
	<v-card-text>
		<v-form v-model="valid">
			<v-row>
				<v-col>
					<v-text-field
						type="number"
						label="Min"
						v-model="modelValue.min"
						:rules="rules.min"
						clearable
						@change="change"
					></v-text-field>
				</v-col>
				<v-col>
					<v-text-field
						type="number"
						label="Max"
						v-model="modelValue.max"
						:rules="rules.max"
						clearable
						@change="change"
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
						@update:model-value="change"
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
		items: {
			type: Array,
			default: () => [],
			required: true,
		},
	},
	computed: {
		values: {
			get() {
				const undefinedPlaceholder = this.items.find(
					(i) => typeof i === 'string',
				)

				if (undefinedPlaceholder) {
					return (
						this.modelValue.values?.map((v) =>
							v === undefined ? undefinedPlaceholder : v,
						) ?? []
					)
				} else {
					return this.modelValue.values ?? []
				}
			},
			set(v) {
				this.modelValue.values = v
			},
		},
	},
	data() {
		return {
			valid: false,
			rules: {
				min: [
					(v) => !v || v >= 0 || 'Minimum should not be negative',
					(v) =>
						!v ||
						!this.modelValue.max ||
						v <= this.modelValue.max ||
						'Minimum should not be above maximum',
				],
				max: [
					(v) => !v || v >= 0 || 'Maximum should not be negative',
					(v) =>
						!v ||
						!this.modelValue.min ||
						v >= this.modelValue.min ||
						'Maximum should not be below minimum',
				],
			},
		}
	},
	methods: {
		change() {
			this.$emit('change', this.modelValue, this.valid)
		},
	},
}
</script>
