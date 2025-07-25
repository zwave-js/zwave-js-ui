<template>
	<v-menu
		v-model="isVisible"
		:close-on-content-click="false"
		location="bottom"
	>
		<template v-slot:activator="{ props }">
			<v-icon
				size="small"
				@click.stop="showOptions()"
				v-bind="props"
				title="Filter options..."
				style="padding-right: 2px; padding-bottom: 3px"
			>
				{{ hasFilter ? 'filter_list_alt' : 'filter_list' }}
			</v-icon>
		</template>
		<v-card :min-width="300">
			<v-icon size="small" @click.stop="hideOptions()" end>close</v-icon>
			<column-filter-boolean
				v-if="column.type == 'boolean'"
				v-model="_value"
			></column-filter-boolean>
			<column-filter-date
				v-if="column.type == 'date'"
				v-model="_value"
				v-model:valid="valid"
			></column-filter-date>
			<column-filter-number
				v-if="column.type == 'number'"
				v-model="_value"
				v-model:valid="valid"
				:items="items"
			></column-filter-number>
			<column-filter-string
				v-if="column.type == 'string'"
				v-model="_value"
				v-model:valid="valid"
				:items="items"
			></column-filter-string>
			<v-checkbox
				v-if="column.groupable != false"
				label="Group values"
				class="ml-4"
				v-model="_groupBy"
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
			type: Array,
			default: () => [],
			required: false,
		},
	},
	data() {
		return {
			valid: true,
			isVisible: false,
		}
	},
	watch: {
		groupBy() {
			this.isVisible = false
		},
		isVisible(val) {
			if (val === false) {
				this.updateFilter()
			}
		},
	},
	computed: {
		hasFilter() {
			return this.hasDeepValue(this.modelValue)
		},
		_value: {
			get() {
				return this.modelValue
			},
			set(value) {
				this.$emit('update:modelValue', value)
			},
		},
		_groupBy: {
			get() {
				return !!this.groupBy.find((g) => g.key === this.column.key)
			},
			set(value) {
				this.$emit(
					'update:group-by',
					value ? [{ key: this.column.key }] : [],
				)
			},
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
			this.isVisible = true
		},
		hideOptions() {
			this.isVisible = false
		},
		updateFilter() {
			if (this.valid === true) {
				// Emit minimal storable filter spec (with empty default values removed):
				this.$emit(
					'update:filter',
					ColumnFilterHelper.filterSpec(
						this.column.type,
						this._value,
					),
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
			this.valid = true
		},
	},
}
</script>
