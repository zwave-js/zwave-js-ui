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

type ToggleableCol =
	| 'activity'
	| 'location'
	| 'value'
	| 'power'
	| 'signal'
	| 'lastSeen'

defineProps<{
	modelValue: readonly ToggleableCol[]
	triggerLabelHidden?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [ToggleableCol[]]
}>()

const TOGGLEABLE_COLS = [
	{ id: 'activity', label: 'Activity' },
	{ id: 'location', label: 'Location' },
	{ id: 'value', label: 'State / Value' },
	{ id: 'power', label: 'Power' },
	{ id: 'signal', label: 'Link' },
	{ id: 'lastSeen', label: 'Last seen' },
]
</script>
