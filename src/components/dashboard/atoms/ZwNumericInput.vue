<template>
	<div class="zw-num" :class="{ 'zw-num--disabled': disabled }">
		<div class="zw-num__field" :class="{ 'zw-num__field--dirty': dirty }">
			<input
				type="text"
				inputmode="numeric"
				class="zw-num__input"
				:value="modelValue"
				:disabled="disabled"
				@input="onInput"
				@keydown="onKeyDown"
			/>
			<div class="zw-num__stepper" aria-hidden="true">
				<button
					type="button"
					tabindex="-1"
					class="zw-num__step"
					:class="{ 'zw-num__step--at-limit': atMax }"
					:disabled="disabled || atMax"
					@click="bump(1)"
				>
					<ChevronUpIcon :size="ICON_SIZE.chip" />
				</button>
				<button
					type="button"
					tabindex="-1"
					class="zw-num__step zw-num__step--down"
					:class="{ 'zw-num__step--at-limit': atMin }"
					:disabled="disabled || atMin"
					@click="bump(-1)"
				>
					<ChevronDownIcon :size="ICON_SIZE.chip" />
				</button>
			</div>
		</div>
		<span v-if="unit" class="zw-num__unit">{{ unit }}</span>
		<button
			v-if="dirty"
			type="button"
			class="zw-num__apply zw-focus-ring"
			title="Apply"
			@click="emit('commit')"
		>
			<CheckIcon :size="ICON_SIZE.dense" />
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ICON_SIZE,
} from '@/lib/icons'

const props = withDefaults(
	defineProps<{
		modelValue: string
		min?: number
		max?: number
		step?: number
		unit?: string
		disabled?: boolean
		// When true, shows the apply button.
		dirty?: boolean
	}>(),
	{ step: 1, disabled: false, dirty: false },
)

const emit = defineEmits<{
	'update:modelValue': [string]
	commit: []
	reset: []
}>()

const atMax = computed(
	() => props.max !== undefined && Number(props.modelValue) >= props.max,
)
const atMin = computed(
	() => props.min !== undefined && Number(props.modelValue) <= props.min,
)

function clamp(v: number): number {
	let n = v
	if (props.min !== undefined && n < props.min) n = props.min
	if (props.max !== undefined && n > props.max) n = props.max
	return n
}

function bump(delta: number): void {
	const base = Number(props.modelValue)
	const next = String(
		clamp((Number.isFinite(base) ? base : 0) + delta * props.step),
	)
	emit('update:modelValue', next)
}

function onInput(e: Event): void {
	emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Enter') {
		if (props.dirty) emit('commit')
	} else if (e.key === 'Escape') {
		if (props.dirty) {
			e.preventDefault()
			e.stopPropagation()
			emit('reset')
		}
	} else if (e.key === 'ArrowUp') {
		e.preventDefault()
		bump(1)
	} else if (e.key === 'ArrowDown') {
		e.preventDefault()
		bump(-1)
	}
}
</script>

<style scoped>
.zw-num {
	display: inline-flex;
	align-items: center;
	gap: 6px;
}

.zw-num--disabled {
	opacity: 0.55;
}

.zw-num__field {
	display: inline-flex;
	align-items: stretch;
	height: 26px;
	border: 1px solid var(--zw-line);
	border-radius: var(--zw-radius-sm);
	overflow: hidden;
	background: var(--zw-bg);
	transition:
		border-color 0.12s,
		background 0.12s;
}

.zw-num__field--dirty {
	border-color: var(--zw-accent);
}

.zw-num__field:focus-within {
	border-color: var(--zw-accent);
	background: var(--zw-card);
}

.zw-num__input {
	appearance: none;
	border: none;
	background: transparent;
	outline: none;
	width: 58px;
	padding: 0 8px;
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 500;
	color: var(--zw-fg);
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.zw-num__stepper {
	display: flex;
	flex-direction: column;
	width: 20px;
	flex-shrink: 0;
	border-left: 1px solid var(--zw-line);
}

.zw-num__step {
	appearance: none;
	border: none;
	background: transparent;
	color: var(--zw-muted);
	cursor: pointer;
	padding: 0;
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	transition:
		background 0.1s,
		color 0.1s;
}

.zw-num__step:hover:not(:disabled) {
	background: var(--zw-row-hover);
	color: var(--zw-fg);
}

.zw-num__step--down {
	border-top: 1px solid var(--zw-line);
}

.zw-num__step--at-limit,
.zw-num__step:disabled {
	opacity: 0.35;
	cursor: default;
}

.zw-num__unit {
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 500;
	color: var(--zw-muted);
}

.zw-num__apply {
	appearance: none;
	border: none;
	background: var(--zw-accent);
	color: rgb(var(--v0-on-primary));
	width: 26px;
	height: 26px;
	border-radius: var(--zw-radius-md);
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	box-shadow: 0 1px 2px rgba(var(--v0-on-surface), 0.2);
	transition: background 0.12s;
}

.zw-num__apply:hover {
	background: var(--zw-accent-dark);
}
</style>
