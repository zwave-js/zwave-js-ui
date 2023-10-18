<template>
	<v-card-text>
		<v-form v-model="valid">
			<v-row>
				<v-col>
					<v-text-field
						type="number"
						label="Min"
						v-model="value.min"
						:rules="rules.min"
						clearable
						@change="change"
					></v-text-field>
				</v-col>
				<v-col>
					<v-text-field
						type="number"
						label="Max"
						v-model="value.max"
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
						deletableChips
						dense
						multiple
						@change="change"
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
		value: {
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
						this.value.values?.map((v) =>
							v === undefined ? undefinedPlaceholder : v,
						) ?? []
					)
				} else {
					return this.value.values ?? []
				}
			},
			set(v) {
				this.value.values = v
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
						!this.value.max ||
						v <= this.value.max ||
						'Minimum should not be above maximum',
				],
				max: [
					(v) => !v || v >= 0 || 'Maximum should not be negative',
					(v) =>
						!v ||
						!this.value.min ||
						v >= this.value.min ||
						'Maximum should not be below minimum',
				],
			},
		}
	},
	methods: {
		change() {
			this.$emit('change', this.value, this.valid)
		},
	},
}
</script>
