<template>
	<v-card-text>
		<v-form>
			<v-row>
				<v-col>
					<v-checkbox
						:indeterminate="_value.boolValue == null"
						v-model="_value.boolValue"
						label="Boolean value"
					></v-checkbox>
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
	},
}
</script>
