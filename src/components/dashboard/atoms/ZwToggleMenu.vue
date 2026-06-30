<template>
	<Popover.Root v-model="open" :id="contentId">
		<Popover.Activator as="button" class="zw-tm__trigger zw-focus-ring">
			<component :is="triggerIcon ?? FilterIcon" :size="ICON_SIZE.chip" />
			<span v-if="!triggerLabelHidden" class="zw-tm__label">
				{{ triggerLabel }}
			</span>
			<span v-if="(badgeCount ?? 0) > 0" class="zw-tm__badge">
				{{ badgeCount }}
			</span>
			<ChevronDownIcon class="zw-tm__chevron" :size="ICON_SIZE.pill" />
		</Popover.Activator>
		<Popover.Content as="div" class="zw-tm__panel" role="menu">
			<div v-if="header" class="zw-tm__header">{{ header }}</div>
			<button
				v-for="opt in options"
				:key="opt.id"
				type="button"
				class="zw-tm__row"
				role="menuitemcheckbox"
				:aria-checked="selectedSet.has(opt.id)"
				@click="onToggle(opt.id)"
			>
				<span
					class="zw-tm__check"
					:class="{ 'zw-tm__check--on': selectedSet.has(opt.id) }"
				>
					<CheckIcon
						v-if="selectedSet.has(opt.id)"
						:size="ICON_SIZE.pill"
						:stroke-width="3"
					/>
				</span>
				<component
					:is="opt.icon"
					v-if="opt.icon"
					:size="ICON_SIZE.chip"
					class="zw-tm__row-icon"
				/>
				<span class="zw-tm__row-label">{{ opt.label }}</span>
			</button>
		</Popover.Content>
	</Popover.Root>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { Component } from 'vue'
import { Popover } from '@vuetify/v0'
import { CheckIcon, ChevronDownIcon, FilterIcon, ICON_SIZE } from '@/lib/icons'
import { usePopoverFallback } from '@/lib/popover-fallback.ts'

interface ToggleMenuOption {
	id: string
	label: string
	icon?: Component
}

// Locale-agnostic: callers pass an already-translated `triggerLabel`, or
// set `triggerLabelHidden` for an icon-only trigger.
const props = defineProps<{
	options: ToggleMenuOption[]
	modelValue: readonly string[]
	triggerIcon?: Component
	triggerLabel?: string
	triggerLabelHidden?: boolean
	header?: string
	badgeCount?: number | null
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const open = ref(false)
const contentId = `zw-tm-${useId()}`

usePopoverFallback({ open, contentId })

// A Set so each option row's membership check is O(1).
const selectedSet = computed(() => new Set(props.modelValue))

function onToggle(id: string): void {
	emit(
		'update:modelValue',
		selectedSet.value.has(id)
			? props.modelValue.filter((x) => x !== id)
			: [...props.modelValue, id],
	)
}
</script>

<style>
.zw-tm__trigger {
	appearance: none;
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 5px;
	padding: 4px 10px;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	color: var(--zw-fg);
	font: var(--zw-text-caption);
	cursor: pointer;
	transition:
		background 0.12s,
		border-color 0.12s;
}

/* V0 Popover.Activator stamps `data-open` on the trigger when the
   popover is open — no Vue class binding needed. */
.zw-tm__trigger[data-open] {
	background: var(--zw-accent-soft);
	border-color: rgba(var(--v0-primary), 0.4);
}

.zw-tm__label {
	white-space: nowrap;
}

.zw-tm__badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 16px;
	height: 16px;
	padding: 0 4px;
	border-radius: var(--zw-radius-pill);
	background: var(--zw-accent);
	color: rgb(var(--v0-on-primary));
	font-size: 10px;
	font-weight: 600;
}

.zw-tm__chevron {
	transition: transform 0.15s;
	color: var(--zw-fg-soft);
}

.zw-tm__trigger[data-open] .zw-tm__chevron {
	transform: rotate(180deg);
}

/* V0 hard-codes `position-area: bottom` + `position-anchor: --<id>` as an
   inline style on the popover and Vue's `patchStyle` re-applies it on every
   render, stripping any inline `!important` we add. An external stylesheet
   rule with `!important` survives those re-patches and lets Floating UI's
   manual top/left writes drive the actual position. */
.zw-tm__panel {
	position-area: none !important;
	position-anchor: auto !important;
	min-width: 220px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line-soft);
	border-radius: 6px;
	box-shadow: var(--zw-e8);
	padding: 4px;
	animation: zw-fade-in 0.12s;
}

/* Reset native :popover style — V0 uses the HTML popover attribute, which
   adds default border, padding, and an inset:auto box. We want our own
   chrome to define those. */
.zw-tm__panel::backdrop {
	display: none;
}

.zw-tm__header {
	padding: 6px 10px 4px;
	font: var(--zw-text-mono-micro);
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

/* Row text uses the Body S type role. */
.zw-tm__row {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	background: transparent;
	border: none;
	cursor: pointer;
	padding: 6px 8px;
	border-radius: 4px;
	color: var(--zw-fg);
	font: var(--zw-text-body-s);
	line-height: 1.3;
	text-align: left;
}

.zw-tm__row:hover {
	background: var(--zw-row-hover);
}

.zw-tm__check {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 14px;
	height: 14px;
	border: 1.5px solid var(--zw-line2);
	border-radius: 3px;
	color: rgb(var(--v0-on-primary));
	flex: 0 0 14px;
}

.zw-tm__check--on {
	background: var(--zw-accent);
	border-color: var(--zw-accent);
}

.zw-tm__row-icon {
	color: var(--zw-fg-soft);
	flex: 0 0 auto;
}

.zw-tm__row-label {
	flex: 1;
}
</style>
