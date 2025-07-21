<template>
	<v-card-text>
		<v-form>
			<v-row>
				<v-col>
					<v-checkbox
						:indeterminate="modelValue.boolValue == null"
						v-model="modelValue.boolValue"
						label="Boolean value"
						@update:model-value="change"
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
	methods: {
		change() {
			this.$emit('change', this.modelValue, true)
		},
	},
}
</script>
