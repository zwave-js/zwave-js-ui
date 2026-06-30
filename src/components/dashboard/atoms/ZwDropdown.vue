<template>
	<Popover.Root v-model="open" :id="contentId">
		<Popover.Activator
			as="button"
			type="button"
			class="zw-dropdown__trigger zw-focus-ring"
			:disabled="disabled"
			:title="triggerLabel"
		>
			<span class="zw-dropdown__trigger-text">{{ triggerLabel }}</span>
			<ChevronDownIcon
				class="zw-dropdown__chevron"
				:size="ICON_SIZE.caret"
			/>
		</Popover.Activator>

		<Popover.Content as="div" class="zw-dropdown__panel">
			<div v-if="showFilter" class="zw-dropdown__filter-row">
				<component
					:is="allowManual ? EditIcon : SearchIcon"
					class="zw-dropdown__filter-icon"
					:size="ICON_SIZE.caret"
				/>
				<input
					ref="filterInputRef"
					v-model="filter"
					type="text"
					class="zw-dropdown__filter-input"
					:placeholder="filterPlaceholder"
					@keydown="onFilterKeyDown"
				/>
			</div>

			<div class="zw-dropdown__list" role="listbox">
				<!-- Combobox manual-entry confirm row -->
				<button
					v-if="manualValid"
					type="button"
					class="zw-dropdown__item zw-dropdown__item--custom"
					role="option"
					@click="pick(manualNum!)"
				>
					<!-- Spacer preserves alignment with the check column -->
					<span
						class="zw-dropdown__check-spacer"
						aria-hidden="true"
					/>
					<span class="zw-dropdown__item-body">
						Set custom value
						<span class="zw-dropdown__manual-value">
							{{ manualNum }}{{ unit ? ` ${unit}` : '' }}
						</span>
					</span>
					<span class="zw-dropdown__enter-hint">Enter ↵</span>
				</button>

				<button
					v-for="opt in filteredOptions"
					:key="String(opt.value)"
					type="button"
					class="zw-dropdown__item"
					:class="{
						'zw-dropdown__item--selected': isSelected(opt.value),
					}"
					role="option"
					:aria-selected="isSelected(opt.value)"
					@click="pick(opt.value)"
				>
					<CheckIcon
						class="zw-dropdown__check"
						:class="{
							'zw-dropdown__check--invisible': !isSelected(
								opt.value,
							),
						}"
						:size="ICON_SIZE.dense"
						aria-hidden="true"
					/>
					<span class="zw-dropdown__item-num">[{{ opt.value }}]</span>
					<span class="zw-dropdown__item-body">{{ opt.label }}</span>
				</button>

				<div
					v-if="filteredOptions.length === 0 && !manualValid"
					class="zw-dropdown__empty"
				>
					{{ emptyLabel }}
				</div>
			</div>
		</Popover.Content>
	</Popover.Root>
</template>

<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue'
import { Popover } from '@vuetify/v0'
import {
	CheckIcon,
	ChevronDownIcon,
	EditIcon,
	SearchIcon,
	ICON_SIZE,
} from '@/lib/icons'
import { usePopoverFallback } from '@/lib/popover-fallback.ts'

// Show the filter input once the list grows beyond this many options.
const OPTIONS_FILTER_THRESHOLD = 6
// Panel is never narrower than this, even under a small trigger.
const MIN_PANEL_WIDTH_PX = 220

type OptionValue = number | string | boolean

interface DropdownOption {
	value: OptionValue
	label: string
}

const props = withDefaults(
	defineProps<{
		modelValue: OptionValue | null
		options: DropdownOption[]
		allowManual?: boolean
		// min/max/unit apply only with allowManual (combobox manual entry).
		min?: number
		max?: number
		unit?: string
		disabled?: boolean
	}>(),
	{ allowManual: false, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [OptionValue] }>()

const open = ref(false)
const filter = ref('')
const filterInputRef = ref<HTMLInputElement | null>(null)
const contentId = `zw-dd-${useId()}`

usePopoverFallback({ open, contentId, placement: 'bottom-start', offsetPx: 4 })

const showFilter = computed(
	() => props.allowManual || props.options.length > OPTIONS_FILTER_THRESHOLD,
)

const filterPlaceholder = computed(() => {
	if (!props.allowManual) return 'Filter…'
	if (props.min !== undefined && props.max !== undefined)
		return `Enter a value (${props.min}–${props.max})…`
	return 'Enter a value…'
})

const filteredOptions = computed(() => {
	const q = filter.value.trim()
	if (!q) return props.options
	const lower = q.toLowerCase()
	return props.options.filter(
		(o) =>
			o.label.toLowerCase().includes(lower) ||
			String(o.value).includes(q),
	)
})

const manualNum = computed<number | null>(() => {
	if (!props.allowManual) return null
	const q = filter.value.trim()
	if (!/^-?\d+(\.\d+)?$/.test(q)) return null
	return Number(q)
})

const manualValid = computed(() => {
	const n = manualNum.value
	if (n === null) return false
	if (props.min !== undefined && n < props.min) return false
	if (props.max !== undefined && n > props.max) return false
	return !props.options.some((o) => String(o.value) === String(n))
})

const selectedKey = computed(() => String(props.modelValue))

const curOpt = computed(() =>
	props.options.find((o) => String(o.value) === selectedKey.value),
)

const triggerLabel = computed(() => {
	if (curOpt.value) return `[${curOpt.value.value}] ${curOpt.value.label}`
	if (props.modelValue !== null && props.modelValue !== undefined)
		return `${props.modelValue}${props.unit ? ` ${props.unit}` : ''} · custom`
	return '—'
})

const emptyLabel = computed(() =>
	props.allowManual ? 'No preset matches — enter a number' : 'No matches',
)

function isSelected(value: OptionValue): boolean {
	return String(value) === selectedKey.value
}

function pick(value: OptionValue): void {
	open.value = false
	emit('update:modelValue', value)
}

function onFilterKeyDown(e: KeyboardEvent): void {
	if (e.key === 'Enter' && manualValid.value && manualNum.value !== null) {
		pick(manualNum.value)
	} else if (e.key === 'Escape') {
		open.value = false
	}
}

// Match panel width to trigger on open; clear filter on close.
watch(
	() => open.value,
	(isOpen) => {
		if (!isOpen) {
			filter.value = ''
			return
		}
		const c = document.getElementById(contentId)
		const a = document.querySelector<HTMLElement>(
			`[popovertarget="${contentId}"]`,
		)
		if (a && c) {
			c.style.setProperty(
				'min-width',
				`${Math.max(a.offsetWidth, MIN_PANEL_WIDTH_PX)}px`,
				'important',
			)
		}
		if (showFilter.value) filterInputRef.value?.focus()
	},
	{ flush: 'post' },
)
</script>

<style>
.zw-dropdown__trigger {
	appearance: none;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: 1px solid var(--zw-line);
	border-radius: var(--zw-radius-sm);
	padding: 0 6px 0 8px;
	height: 26px;
	min-width: 130px;
	max-width: 260px;
	background: var(--zw-bg);
	color: var(--zw-fg);
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 500;
	font-variant-numeric: tabular-nums;
	cursor: pointer;
	transition:
		border-color 0.12s,
		background 0.12s;
}

.zw-dropdown__trigger:hover:not(:disabled) {
	border-color: var(--zw-line2);
}

/* V0 sets data-open on Popover.Activator while the popover is open. */
.zw-dropdown__trigger[data-open] {
	border-color: var(--zw-accent);
	background: var(--zw-card);
}

.zw-dropdown__trigger:disabled {
	opacity: 0.55;
	cursor: default;
	pointer-events: none;
}

.zw-dropdown__trigger-text {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	text-align: left;
}

.zw-dropdown__chevron {
	flex-shrink: 0;
	color: var(--zw-muted);
	transition: transform 0.12s;
}

.zw-dropdown__trigger[data-open] .zw-dropdown__chevron {
	transform: rotate(180deg);
}

/* See ZwToggleMenu for why position-area override needs !important. */
.zw-dropdown__panel {
	position-area: none !important;
	position-anchor: auto !important;
	background: var(--zw-card);
	border: 1px solid var(--zw-line2);
	border-radius: var(--zw-radius-md);
	box-shadow: var(--zw-e8);
	max-height: 300px;
	overflow: hidden;
	padding: 0;
	animation: zw-fade-in 0.12s;
}

/* display:flex must live here, not on the base rule — otherwise it overrides
   the UA `[popover]:not(:popover-open) { display:none }` and the panel renders
   visibly even while closed. */
.zw-dropdown__panel:popover-open {
	display: flex;
	flex-direction: column;
}

.zw-dropdown__panel::backdrop {
	display: none;
}

.zw-dropdown__filter-row {
	position: relative;
	padding: 5px 6px;
	border-bottom: 1px solid var(--zw-line);
	flex-shrink: 0;
}

.zw-dropdown__filter-icon {
	position: absolute;
	left: 14px;
	top: 50%;
	transform: translateY(-50%);
	color: var(--zw-muted);
	pointer-events: none;
}

.zw-dropdown__filter-input {
	width: 100%;
	box-sizing: border-box;
	appearance: none;
	border: 1px solid var(--zw-line);
	border-radius: var(--zw-radius-sm);
	padding: 4px 8px 4px 26px;
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 500;
	background: var(--zw-bg);
	color: var(--zw-fg);
	outline: none;
	transition: border-color 0.12s;
}

.zw-dropdown__filter-input:focus {
	border-color: var(--zw-accent);
}

.zw-dropdown__list {
	overflow-y: auto;
	padding: 3px;
}

.zw-dropdown__item {
	appearance: none;
	border: none;
	background: transparent;
	cursor: pointer;
	text-align: left;
	color: var(--zw-fg);
	border-radius: var(--zw-radius-sm);
	padding: 5px 8px;
	display: flex;
	align-items: center;
	gap: 7px;
	width: 100%;
	font-size: 12px;
	line-height: 1.3;
	transition: background 0.1s;
}

.zw-dropdown__item:hover {
	background: var(--zw-row-hover);
}

.zw-dropdown__item--selected {
	background: var(--zw-accent-soft);
}

.zw-dropdown__item--custom {
	color: var(--zw-accent);
}

/* Invisible placeholder keeps the check column width consistent. */
.zw-dropdown__check-spacer {
	display: inline-block;
	width: 13px;
	flex-shrink: 0;
}

.zw-dropdown__check {
	flex-shrink: 0;
	color: var(--zw-accent);
}

.zw-dropdown__check--invisible {
	opacity: 0;
}

/* [N] prefix in monospace-muted */
.zw-dropdown__item-num {
	flex-shrink: 0;
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 500;
	color: var(--zw-muted);
	font-variant-numeric: tabular-nums;
}

.zw-dropdown__item-body {
	flex: 1;
	min-width: 0;
}

/* The value part of the manual entry "Set custom value N unit" */
.zw-dropdown__manual-value {
	font-family: var(--zw-mono);
}

.zw-dropdown__enter-hint {
	font-family: var(--zw-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--zw-muted);
	flex-shrink: 0;
}

.zw-dropdown__empty {
	padding: 8px 10px;
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}
</style>
