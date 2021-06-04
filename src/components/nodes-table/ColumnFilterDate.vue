<template>
	<v-card-text>
		<v-form v-model="valid">
			<v-row>
				<v-col>
					<v-text-field
						type="datetime-local"
						label="From"
						v-model="value.from"
						:rules="rules.from"
						clearable
						@change="change"
					></v-text-field>
					<v-text-field
						type="datetime-local"
						label="To"
						v-model="value.to"
						:rules="rules.to"
						clearable
						@change="change"
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
		value: {
			type: Object,
			default: () => ColumnFilterHelper.defaultFilter('string'),
			required: true,
		},
	},
	data() {
		return {
			valid: false,
			rules: {
				from: [
					(v) =>
						!v ||
						!this.value.to ||
						v <= this.value.to ||
						'From date should not be after to date',
				],
				to: [
					(v) =>
						!v ||
						!this.value.from ||
						v >= this.value.from ||
						'To date should not be before from date',
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
