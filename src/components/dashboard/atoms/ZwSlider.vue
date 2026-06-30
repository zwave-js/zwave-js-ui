<template>
	<Slider.Root
		class="zw-slider"
		:class="{ 'zw-slider--sm': size === 'sm' }"
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

withDefaults(
	defineProps<{
		modelValue: number
		disabled?: boolean
		size?: 'md' | 'sm'
	}>(),
	{ size: 'md' },
)

const emit = defineEmits<{ 'update:modelValue': [number] }>()

// Slider.Root accepts scalar v-model and emits scalar back, but TypeScript
// doesn't infer the scalar case — narrow here.
function onUpdate(value: number | number[]): void {
	emit('update:modelValue', Array.isArray(value) ? (value[0] ?? 0) : value)
}
</script>

<style>
.zw-slider {
	position: relative;
	height: 14px;
	display: flex;
	align-items: center;
	cursor: pointer;
	touch-action: none;
	--zw-slider-track: 6px;
	--zw-slider-thumb: 14px;
}

/* sm variant: proportional 2.33× thumb:track scaled from 14×6 to 10×4. */
.zw-slider--sm {
	height: 10px;
	--zw-slider-track: 4px;
	--zw-slider-thumb: 10px;
}

.zw-slider[data-disabled='true'] {
	opacity: 0.5;
	pointer-events: none;
}

/* Hit area spans the full slider height for click-to-jump. */
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
	height: var(--zw-slider-track);
	transform: translateY(-50%);
	background: var(--zw-line);
	border-radius: var(--zw-radius-pill);
}

.zw-slider__fill {
	display: block;
	position: absolute;
	top: 50%;
	height: var(--zw-slider-track);
	transform: translateY(-50%);
	background: var(--zw-accent);
	border-radius: var(--zw-radius-pill);
	transition: width 0.05s;
}

.zw-slider__thumb {
	position: absolute;
	top: 50%;
	width: var(--zw-slider-thumb);
	height: var(--zw-slider-thumb);
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
