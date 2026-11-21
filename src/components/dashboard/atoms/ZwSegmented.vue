<template>
	<Button.Group
		class="zw-segmented"
		:class="{ 'zw-segmented--compact': compact }"
		:model-value="modelValue"
		:mandatory="true"
		@update:model-value="onSelect"
	>
		<Button.Root
			v-for="opt in options"
			:key="opt.value"
			:value="opt.value"
			class="zw-segmented__btn zw-focus-ring"
		>
			<component :is="opt.icon" v-if="opt.icon" :size="ICON_SIZE.chip" />
			<span v-if="!compact">{{ opt.label }}</span>
		</Button.Root>
	</Button.Group>
</template>

<script setup lang="ts">
import { Button } from '@vuetify/v0'
import type { Component } from 'vue'
import { ICON_SIZE } from '@/lib/icons'

interface SegmentedOption {
	value: string
	label: string
	icon?: Component
}

defineProps<{
	modelValue: string
	options: SegmentedOption[]
	compact?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

// Button.Group with `mandatory: true` emits a string, but the type is
// `unknown` — narrow before forwarding.
function onSelect(value: unknown): void {
	if (typeof value === 'string') emit('update:modelValue', value)
}
</script>

<style>
.zw-segmented {
	display: inline-flex;
	background: var(--zw-bg);
	border-radius: 5px;
	padding: 2px;
	border: 1px solid var(--zw-line-soft);
}

.zw-segmented__btn {
	appearance: none;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--zw-fg-soft);
	padding: 3px 8px;
	border-radius: 4px;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font: var(--zw-text-caption);
	line-height: 1.4;
	letter-spacing: 0.1px;
	transition:
		background 0.12s,
		color 0.12s;
}

.zw-segmented--compact .zw-segmented__btn {
	padding: 3px 7px;
}

/* V0 ButtonRoot emits `data-selected="true"` when selected inside a group. */
.zw-segmented__btn[data-selected='true'] {
	background: var(--zw-card);
	color: var(--zw-accent);
	box-shadow: 0 1px 2px rgba(var(--v0-on-surface), 0.1);
	font-weight: 600;
}
</style>
