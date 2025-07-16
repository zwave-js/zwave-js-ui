<template>
	<v-card-text>
		<v-form v-model="valid">
			<v-row>
				<v-col>
					<v-text-field
						label="Search"
						hint="Supports regular expressions"
						v-model="value.match"
						:rules="rules.match"
						clearable
						@change="change"
					></v-text-field>
				</v-col>
			</v-row>
			<v-row>
				<v-col>
					<v-select
						v-model="value.values"
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
	data() {
		return {
			valid: false,
			rules: {
				match: [(v) => this.validateRegex(v)],
			},
		}
	},
	methods: {
		change() {
			this.$emit('change', this.value, this.valid)
		},
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
