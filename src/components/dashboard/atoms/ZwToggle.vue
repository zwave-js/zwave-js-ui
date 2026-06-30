<template>
	<Switch.Root
		class="zw-toggle zw-focus-ring"
		:class="`zw-toggle--${size}`"
		:model-value="modelValue"
		:disabled="disabled"
		@update:model-value="emit('update:modelValue', $event)"
	>
		<Switch.Thumb class="zw-toggle__thumb" />
	</Switch.Root>
</template>

<script setup lang="ts">
import { Switch } from '@vuetify/v0'

withDefaults(
	defineProps<{
		modelValue: boolean
		size?: 'md' | 'sm'
		disabled?: boolean
	}>(),
	{ size: 'md', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<style>
.zw-toggle {
	appearance: none;
	border: none;
	cursor: pointer;
	padding: 0;
	position: relative;
	border-radius: var(--zw-radius-pill);
	transition: background 0.18s;
	--zw-focus-offset: 2px;
}

.zw-toggle[data-disabled='true'] {
	pointer-events: none;
	opacity: 0.5;
}

/* Override SwitchThumb's inline visibility:hidden on unchecked state. */
.zw-toggle__thumb {
	visibility: visible !important;
	position: absolute;
	background: rgb(var(--v0-on-primary));
	border-radius: 50%;
	transition: left 0.18s;
}

/* ── md (44 × 26) — card-view primary controls ─────────────── */
.zw-toggle--md {
	width: 44px;
	height: 26px;
	background: var(--zw-line);
}

.zw-toggle--md[data-state='checked'] {
	background: var(--zw-accent);
}

.zw-toggle--md .zw-toggle__thumb {
	width: 20px;
	height: 20px;
	top: 3px;
	left: 3px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

.zw-toggle--md[data-state='checked'] .zw-toggle__thumb {
	left: 21px;
}

/* ── sm (30 × 16) — table-row controls ─────────────────────── */
.zw-toggle--sm {
	width: 30px;
	height: 16px;
	background: var(--zw-line2);
}

.zw-toggle--sm[data-state='checked'] {
	background: var(--zw-accent);
}

.zw-toggle--sm .zw-toggle__thumb {
	width: 12px;
	height: 12px;
	top: 2px;
	left: 2px;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.zw-toggle--sm[data-state='checked'] .zw-toggle__thumb {
	left: 16px;
}
</style>
