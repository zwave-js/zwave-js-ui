<template>
	<v-menu v-model="show" :close-on-content-click="false" location="bottom">
		<template v-slot:activator="{ props }">
			<v-icon
				size="small"
				@click="showOptions"
				v-bind="props"
				title="Filter options..."
				style="padding-right: 2px; padding-bottom: 3px"
			>
				{{ hasFilter ? 'filter_list_alt' : 'filter_list' }}
			</v-icon>
		</template>
		<v-card :min-width="300">
			<v-icon size="small" @click="hideOptions" end>close</v-icon>
			<column-filter-boolean
				v-if="column.type == 'boolean'"
				:modelValue="modelValue"
				@change="change"
			></column-filter-boolean>
			<column-filter-date
				v-if="column.type == 'date'"
				:modelValue="modelValue"
				@change="change"
			></column-filter-date>
			<column-filter-number
				v-if="column.type == 'number'"
				:modelValue="modelValue"
				:items="items"
				@change="change"
			></column-filter-number>
			<column-filter-string
				v-if="column.type == 'string'"
				:modelValue="modelValue"
				:items="items"
				@change="change"
			></column-filter-string>
			<v-checkbox
				v-if="column.groupable != false"
				label="Group values"
				class="ml-4"
				:modelValue="groupBy"
				@update:model-value="
					$emit('update:group-by', $event ? [column.key] : [])
				"
			></v-checkbox>
			<v-card-actions>
				<v-btn @click="clearFilter">Clear</v-btn>
				<v-btn color="primary" @click="confirm" :disabled="!valid"
					>Ok</v-btn
				>
			</v-card-actions>
		</v-card>
	</v-menu>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'

export default {
	components: {
		ColumnFilterBoolean: defineAsyncComponent(
			() => import('./ColumnFilterBoolean.vue'),
		),
		ColumnFilterDate: defineAsyncComponent(
			() => import('./ColumnFilterDate.vue'),
		),
		ColumnFilterNumber: defineAsyncComponent(
			() => import('./ColumnFilterNumber.vue'),
		),
		ColumnFilterString: defineAsyncComponent(
			() => import('./ColumnFilterString.vue'),
		),
	},
	props: {
		modelValue: {
			type: Object,
			default: () => {},
			required: true,
		},
		column: {
			type: Object,
			default: () => {},
			required: true,
		},
		items: {
			type: Array,
			default: () => [],
			required: true,
		},
		groupBy: {
			type: Boolean,
			default: () => false,
			required: false,
		},
	},
	data() {
		return {
			valid: true,
			show: false,
		}
	},
	computed: {
		hasFilter() {
			return this.hasDeepValue(this.modelValue)
		},
	},
	methods: {
		hasDeepValue(obj) {
			return (
				obj !== undefined &&
				obj !== null &&
				Object.keys(obj).some(
					(k) =>
						(!!obj[k] && !!Object.keys(obj[k]).length) ||
						typeof obj[k] === 'boolean',
				)
			)
		},
		showOptions() {
			this.show = true
		},
		hideOptions() {
			this.show = false
		},
		change(value, valid) {
			this.valid = valid
			if (valid === true) {
				// Emit minimal storable filter spec (with empty default values removed):
				this.$emit(
					'change',
					ColumnFilterHelper.filterSpec(this.column.type, value),
				)
			}
		},
		confirm() {
			this.hideOptions()
		},
		resetToDefaults() {
			// Non-destructive value reset to prevent vue warnings:
			const defaults = ColumnFilterHelper.defaultFilter(this.column.type)
			Object.assign(this.modelValue, defaults)
			for (const key in this.modelValue) {
				if (Object.hasOwnProperty.call(this.modelValue, key)) {
					Object.keys(this.modelValue).forEach(() => {
						if (!Object.keys(defaults).includes(key)) {
							delete this.modelValue.key
						}
					})
				}
			}
		},
		clearFilter() {
			this.resetToDefaults()
			this.change(this.modelValue, true)
		},
	},
}
</script>
