<template>
	<Slider.Root
		class="zw-slider"
		:model-value="modelValue"
		:disabled="disabled"
		:min="0"
		:max="100"
		:step="1"
		@update:model-value="onUpdate"
	>
		<Slider.Track class="zw-slider__track">
			<Slider.Range class="zw-slider__fill" />
		</Slider.Track>
		<Slider.Thumb class="zw-slider__thumb" />
	</Slider.Root>
</template>

<script setup lang="ts">
import { Slider } from '@vuetify/v0'

defineProps<{
	modelValue: number
	disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [number] }>()

// Slider.Root accepts scalar v-model and emits scalar back, but typescript
// doesn't infer the scalar case so we narrow here.
function onUpdate(value: number | number[]): void {
	emit('update:modelValue', Array.isArray(value) ? (value[0] ?? 0) : value)
}
</script>

<style>
/* Styles unscoped — V0 primitives set inheritAttrs:false so Vue does not
   forward the parent's scoped data-v-* hash onto the rendered elements.
   .zw-slider namespace is unique to this atom. */
.zw-slider {
	position: relative;
	height: 14px;
	display: flex;
	align-items: center;
	cursor: pointer;
	touch-action: none;
}

.zw-slider[data-disabled='true'] {
	opacity: 0.5;
	pointer-events: none;
}

/* Track captures pointerdown for click-to-jump, so its hit area spans
   the full 14-px slider row even though the visual line is 6 px — clicks
   in the padding above/below the line still register. */
.zw-slider__track {
	display: block;
	position: relative;
	height: 100%;
	width: 100%;
	background: transparent;
}

.zw-slider__track::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 0;
	right: 0;
	height: 6px;
	transform: translateY(-50%);
	background: var(--zw-line);
	border-radius: var(--zw-radius-pill);
}

.zw-slider__fill {
	display: block;
	position: absolute;
	top: 50%;
	height: 6px;
	transform: translateY(-50%);
	background: var(--zw-accent);
	border-radius: var(--zw-radius-pill);
	transition: width 0.05s;
}

/* 14-px solid accent disc. Drop-shadow at rest carries the "grabbable"
   affordance; halo grows on hover and dragging. V0 sets inline
   `left: <pct>%` so we translate(-50%) to center the disc on the value. */
.zw-slider__thumb {
	position: absolute;
	top: 50%;
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: var(--zw-accent);
	transform: translate(-50%, -50%);
	box-shadow: 0 1px 2px rgba(var(--v0-on-surface), 0.2);
	transition: box-shadow 0.15s;
	outline: none;
}

.zw-slider:hover .zw-slider__thumb {
	box-shadow:
		0 0 0 5px rgba(var(--v0-primary), 0.1),
		0 1px 2px rgba(var(--v0-on-surface), 0.2);
}

.zw-slider__thumb[data-state='dragging'],
.zw-slider:hover .zw-slider__thumb[data-state='dragging'] {
	box-shadow:
		0 0 0 8px rgba(var(--v0-primary), 0.18),
		0 1px 2px rgba(var(--v0-on-surface), 0.2);
}

.zw-slider__thumb:focus-visible {
	box-shadow:
		0 0 0 5px rgba(var(--v0-primary), 0.18),
		0 1px 2px rgba(var(--v0-on-surface), 0.2);
}
</style>
