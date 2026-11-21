<template>
	<ZwToggleMenu
		:options="TOGGLEABLE_COLS"
		:model-value="modelValue"
		trigger-label="Columns"
		:trigger-label-hidden="triggerLabelHidden"
		header="Toggle columns"
		:badge-count="TOGGLEABLE_COLS.length - modelValue.length"
		@update:model-value="
			(next) => emit('update:modelValue', next as ToggleableCol[])
		"
	/>
</template>

<script setup lang="ts">
import ZwToggleMenu from '@/components/dashboard/atoms/ZwToggleMenu.vue'
import { TOGGLEABLE_COLS, type ToggleableCol } from './deviceRowGrid'

defineProps<{
	modelValue: readonly ToggleableCol[]
	triggerLabelHidden?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [ToggleableCol[]]
}>()
</script>
