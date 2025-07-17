<template>
	<v-card-text>
		<v-form>
			<v-row>
				<v-col>
					<v-checkbox
						:indeterminate="value.boolValue == null"
						v-model="value.boolValue"
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
		value: {
			type: Object,
			default: () => ColumnFilterHelper.defaultFilter('string'),
			required: true,
		},
	},
	methods: {
		change() {
			this.$emit('change', this.value, true)
		},
	},
}
</script>
