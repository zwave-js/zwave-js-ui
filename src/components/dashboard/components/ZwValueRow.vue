<template>
	<div
		class="zw-vrow"
		:class="{
			'zw-vrow--dirty': dirty,
			'zw-vrow--button': param.kind === 'button',
		}"
	>
		<!-- label line -->
		<div
			class="zw-vrow__head"
			:class="{ 'zw-vrow__head--center': param.kind === 'button' }"
		>
			<div class="zw-vrow__label-wrap">
				<!-- A button command carries its label on the button itself, so
				     it lives on this row (centered) instead of a control line. -->
				<template v-if="param.kind === 'button'">
					<button
						type="button"
						class="zw-vrow__cmd"
						:disabled="busy"
						@click="commit(true)"
					>
						{{ param.label || 'Run' }}
					</button>
					<span v-if="busy" class="zw-vrow__status">
						<RefreshIcon :size="ICON_SIZE.chip" class="zw-spin" />
						Setting…
					</span>
				</template>
				<template v-else>
					<span
						v-if="param.modified"
						class="zw-vrow__moddot"
						:title="`Modified — default: ${param.default}`"
					/>
					<span v-if="param.paramNumber" class="zw-vrow__num"
						>#{{ param.paramNumber }}</span
					>
					<span class="zw-vrow__label">{{ param.label }}</span>
				</template>
			</div>

			<Popover.Root v-model="menuOpen" :id="menuId">
				<Popover.Activator
					as="button"
					class="zw-vrow__menu-btn zw-focus-ring"
					title="More"
				>
					<MoreIcon :size="ICON_SIZE.inline" />
				</Popover.Activator>
				<Popover.Content as="div" class="zw-vrow__menu" role="menu">
					<button
						type="button"
						class="zw-vrow__menu-item zw-vrow__menu-item--id"
						title="Click to copy"
						@click="copyId"
					>
						<span class="zw-vrow__menu-id"
							>Value ID: {{ param.id }}</span
						>
						<component
							:is="copied ? CheckIcon : CopyIcon"
							:size="ICON_SIZE.chip"
							class="zw-vrow__menu-copy"
							:class="{ 'zw-vrow__menu-copy--done': copied }"
						/>
					</button>
					<button
						v-if="param.readable"
						type="button"
						class="zw-vrow__menu-item"
						@click="refresh"
					>
						<RefreshIcon :size="ICON_SIZE.dense" /> Refresh value
					</button>
					<button
						v-if="param.paramNumber"
						type="button"
						class="zw-vrow__menu-item"
						:disabled="!param.modified"
						@click="param.modified && resetDefault()"
					>
						<ResetIcon :size="ICON_SIZE.dense" /> Reset to default
					</button>
				</Popover.Content>
			</Popover.Root>
		</div>

		<!-- value / control line (the button kind renders inline above) -->
		<div
			v-if="param.kind !== 'button'"
			class="zw-vrow__control"
			:class="{ 'zw-vrow__control--busy': busy }"
		>
			<!-- read-only display -->
			<template v-if="param.readonly">
				<span
					v-if="param.kind === 'color'"
					class="zw-vrow__swatch"
					:style="{ background: String(param.value) }"
				/>
				<span
					class="zw-vrow__display"
					:class="{ 'zw-vrow__display--enum': param.kind === 'enum' }"
					>{{ param.display }}</span
				>
			</template>

			<!-- switch -->
			<template v-else-if="param.kind === 'switch'">
				<ZwToggle
					:model-value="!!cur"
					size="sm"
					:disabled="busy"
					@update:model-value="commit($event)"
				/>
				<span class="zw-vrow__mono">{{ cur ? 'ON' : 'OFF' }}</span>
			</template>

			<!-- enum select -->
			<template v-else-if="param.kind === 'enum'">
				<select
					class="zw-vrow__select"
					:value="String(cur)"
					:disabled="busy"
					@change="onEnumChange"
				>
					<option
						v-for="o in param.options"
						:key="o.value"
						:value="String(o.value)"
					>
						[{{ o.value }}] {{ o.label }}
					</option>
				</select>
			</template>

			<!-- number -->
			<template v-else-if="param.kind === 'number'">
				<input
					class="zw-vrow__input"
					type="number"
					:value="cur"
					:min="param.min"
					:max="param.max"
					:step="param.step || 1"
					:disabled="busy"
					@input="onInput"
					@keydown.enter="send"
				/>
				<span v-if="param.unit" class="zw-vrow__unit">{{
					param.unit
				}}</span>
				<button
					v-if="dirty"
					type="button"
					class="zw-vrow__apply"
					title="Apply"
					@click="send"
				>
					<CheckIcon :size="ICON_SIZE.dense" />
				</button>
			</template>

			<!-- level slider — commits on release -->
			<template v-else-if="param.kind === 'level'">
				<span
					class="zw-vrow__slider"
					@pointerup.capture="commitLevel"
					@keyup.capture="commitLevel"
				>
					<ZwSlider
						:model-value="levelValue"
						size="sm"
						:disabled="busy"
						@update:model-value="draft = $event"
					/>
				</span>
				<span class="zw-vrow__mono zw-vrow__pct"
					>{{ levelValue }}%</span
				>
			</template>

			<!-- text -->
			<template v-else-if="param.kind === 'text'">
				<input
					class="zw-vrow__input zw-vrow__input--text"
					type="text"
					:value="cur"
					:disabled="busy"
					@input="onInput"
					@keydown.enter="send"
				/>
				<span v-if="param.unit" class="zw-vrow__unit">{{
					param.unit
				}}</span>
				<button
					v-if="dirty"
					type="button"
					class="zw-vrow__apply"
					title="Apply"
					@click="send"
				>
					<CheckIcon :size="ICON_SIZE.dense" />
				</button>
			</template>

			<!-- color (writeable values render display-only in this theme) -->
			<template v-else-if="param.kind === 'color'">
				<span
					class="zw-vrow__swatch"
					:style="{ background: String(param.value) }"
				/>
				<span class="zw-vrow__mono">{{ param.display }}</span>
			</template>

			<span v-if="busy" class="zw-vrow__status">
				<RefreshIcon :size="ICON_SIZE.chip" class="zw-spin" />
				{{ sending ? 'Setting…' : 'Refreshing…' }}
			</span>
		</div>

		<!-- description -->
		<div v-if="param.description" class="zw-vrow__desc">
			{{ param.description }}
		</div>

		<!-- numeric range meta — only for editable numbers -->
		<div
			v-if="
				param.kind === 'number' &&
				!param.readonly &&
				param.min !== undefined
			"
			class="zw-vrow__range"
		>
			{{ rangeMeta }}
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref, useId, watch } from 'vue'
import { Popover } from '@vuetify/v0'
import ZwToggle from '@/components/dashboard/atoms/ZwToggle.vue'
import ZwSlider from '@/components/dashboard/atoms/ZwSlider.vue'
import {
	CheckIcon,
	CopyIcon,
	ICON_SIZE,
	MoreIcon,
	RefreshIcon,
	ResetIcon,
} from '@/lib/icons'
import { usePopoverFallback } from '@/lib/popover-fallback.ts'
import type { ValueParam } from '@/lib/valueGroups.ts'
import {
	DeviceActionPendingKey,
	pollPendingKey,
	setPendingKey,
} from '@/components/dashboard/deviceActionPending.ts'
import type { ValueID } from '@zwave-js/core'

const props = defineProps<{
	param: ValueParam
	nodeId: number
}>()
const emit = defineEmits<{
	set: [ValueID, unknown]
	poll: [ValueID]
}>()

// Pending edit until applied; null = show the live value. Clears on confirm.
const draft = ref<unknown>(null)
const copied = ref(false)
const menuOpen = ref(false)
const menuId = `zw-vrow-${useId()}`

usePopoverFallback({ open: menuOpen, contentId: menuId })

// Busy state from the host's pending set — clears the instant `apiRequest` resolves.
const pending = inject(DeviceActionPendingKey, new Set<string>())
const sending = computed(() =>
	pending.has(setPendingKey(props.nodeId, props.param.target)),
)
const refreshing = computed(() =>
	pending.has(pollPendingKey(props.nodeId, props.param.target)),
)

const cur = computed(() =>
	draft.value !== null ? draft.value : props.param.value,
)
const dirty = computed(
	() =>
		draft.value !== null &&
		String(draft.value) !== String(props.param.value),
)
const busy = computed(() => sending.value || refreshing.value)
const levelValue = computed(() => Number(cur.value) || 0)

// Range hint under an editable number; default segment only when one exists.
const rangeMeta = computed(() => {
	const p = props.param
	const range = `min ${p.min} · max ${p.max}`
	return p.default !== undefined ? `${range} · default ${p.default}` : range
})

// Once the confirmed value updates, drop the optimistic draft.
watch(
	() => props.param.value,
	() => {
		draft.value = null
	},
)

function coerce(raw: unknown): unknown {
	if (props.param.kind === 'number' || props.param.kind === 'level') {
		return Number(raw)
	}
	return raw
}

function commit(value: unknown) {
	menuOpen.value = false
	draft.value = value
	emit('set', props.param.target, value)
}

function send() {
	if (dirty.value) commit(coerce(draft.value))
}

function onInput(e: Event) {
	draft.value = (e.target as HTMLInputElement).value
}

function onEnumChange(e: Event) {
	const raw = (e.target as HTMLSelectElement).value
	const opt = props.param.options?.find((o) => String(o.value) === raw)
	commit(opt ? opt.value : raw)
}

function commitLevel() {
	if (draft.value === null) return
	// Multilevel Switch tops out at 99 (100/255 mean "restore"); the slider
	// track is 0–100, so clamp before writing.
	const level = Math.min(99, Math.max(0, Number(draft.value)))
	if (level !== Number(props.param.value)) {
		commit(level)
	} else {
		draft.value = null
	}
}

function refresh() {
	menuOpen.value = false
	emit('poll', props.param.target)
}

function resetDefault() {
	if (props.param.default !== undefined) commit(props.param.default)
}

function copyId() {
	try {
		void navigator.clipboard?.writeText(props.param.id)
	} catch {
		// Clipboard may be unavailable (insecure context); ignore.
	}
	copied.value = true
	setTimeout(() => {
		copied.value = false
	}, 1200)
}
</script>

<style>
/* Unscoped — the V0 Popover primitive sets inheritAttrs:false, so the
   scoped data-v-* hash never reaches the menu. .zw-vrow is unique here. */
.zw-vrow {
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	/* Fill the (equal-height) grid cell so a short row can center its
	   content vertically; see .zw-vgroup__cell. */
	flex: 1;
	min-width: 0;
	background: transparent;
	/* Row separation comes from the .zw-vgroup__body grid gap, not a per-row
	   border — each row is the only cell in its grid track. */
	transition: background 0.15s;
}

/* A button command has a single short row — center it in the tall cell. */
.zw-vrow--button {
	justify-content: center;
}

.zw-vrow--dirty {
	background: rgba(var(--v0-primary), 0.05);
}

/* ── label line ── */
.zw-vrow__head {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}

/* A button command is the whole row — center the menu against the button. */
.zw-vrow__head--center {
	align-items: center;
}

.zw-vrow__head--center .zw-vrow__label-wrap {
	align-items: center;
}

.zw-vrow__label-wrap {
	min-width: 0;
	flex: 1;
	display: flex;
	align-items: flex-start;
	gap: 6px;
}

.zw-vrow__moddot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--zw-accent);
	flex-shrink: 0;
	margin-top: 6px;
}

.zw-vrow__num {
	font-family: var(--zw-mono);
	font-size: 11px;
	font-weight: 600;
	color: var(--zw-accent);
	flex-shrink: 0;
	line-height: 17px;
}

.zw-vrow__label {
	font-size: 12px;
	font-weight: 500;
	color: var(--zw-fg);
	min-width: 0;
	line-height: 17px;
	overflow-wrap: anywhere;
}

.zw-vrow__menu-btn {
	appearance: none;
	border: none;
	background: transparent;
	color: var(--zw-muted);
	cursor: pointer;
	padding: 3px;
	border-radius: 4px;
	display: inline-flex;
	align-items: center;
	flex-shrink: 0;
}

.zw-vrow__menu-btn[data-open] {
	background: var(--zw-chip-bg);
}

/* See ZwToggleMenu for why these position overrides need !important. */
.zw-vrow__menu {
	position-area: none !important;
	position-anchor: auto !important;
	min-width: 210px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line2);
	border-radius: 6px;
	box-shadow: var(--zw-e8);
	padding: 0;
	overflow: hidden;
	animation: zw-fade-in 0.12s;
}

.zw-vrow__menu::backdrop {
	display: none;
}

.zw-vrow__menu-item {
	width: 100%;
	appearance: none;
	border: none;
	background: transparent;
	cursor: pointer;
	text-align: left;
	color: var(--zw-fg);
	padding: 8px 10px;
	display: flex;
	align-items: center;
	gap: 8px;
	font: var(--zw-text-body-s);
	border-top: 1px solid var(--zw-line);
}

.zw-vrow__menu-item:first-child {
	border-top: none;
}

.zw-vrow__menu-item:not(:disabled):hover {
	background: var(--zw-row-hover);
}

.zw-vrow__menu-item:disabled {
	color: var(--zw-muted);
	cursor: default;
	opacity: 0.5;
}

.zw-vrow__menu-item--id {
	cursor: copy;
}

.zw-vrow__menu-id {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	flex: 1;
	min-width: 0;
	word-break: break-all;
}

.zw-vrow__menu-copy {
	color: var(--zw-muted);
	flex-shrink: 0;
}

.zw-vrow__menu-copy--done {
	color: var(--zw-accent);
}

/* ── control line ── */
.zw-vrow__control {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	transition: opacity 0.15s;
}

.zw-vrow__control--busy {
	opacity: 0.55;
}

.zw-vrow__display {
	font-family: var(--zw-mono);
	font-size: 14px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	overflow-wrap: anywhere;
}

.zw-vrow__display--enum {
	font-weight: 600;
	font-size: 13px;
}

.zw-vrow__mono {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-fg);
}

.zw-vrow__pct {
	min-width: 34px;
	text-align: right;
}

.zw-vrow__select,
.zw-vrow__input {
	appearance: none;
	border: 1px solid var(--zw-line);
	border-radius: 4px;
	padding: 3px 8px;
	font-size: 11px;
	background: var(--zw-bg);
	color: var(--zw-fg);
	font-family: var(--zw-mono);
}

.zw-vrow__select {
	padding-right: 22px;
	cursor: pointer;
	max-width: 240px;
	text-overflow: ellipsis;
}

.zw-vrow__input {
	width: 80px;
	text-align: right;
}

.zw-vrow__input--text {
	width: 180px;
	text-align: left;
}

.zw-vrow__unit {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-vrow__slider {
	flex: 1;
	min-width: 80px;
	max-width: 160px;
	display: inline-flex;
	align-items: center;
}

.zw-vrow__apply {
	appearance: none;
	border: none;
	background: var(--zw-accent);
	color: #fff;
	width: 26px;
	height: 26px;
	border-radius: 6px;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	box-shadow: 0 1px 2px rgba(var(--v0-on-surface), 0.2);
}

.zw-vrow__cmd {
	appearance: none;
	border: none;
	background: var(--zw-accent);
	color: #fff;
	padding: 5px 12px;
	border-radius: 6px;
	font: var(--zw-text-label);
	cursor: pointer;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-vrow__cmd:disabled {
	opacity: 0.55;
	cursor: default;
}

.zw-vrow__swatch {
	width: 16px;
	height: 16px;
	border-radius: 4px;
	border: 1px solid var(--zw-line);
	flex-shrink: 0;
}

.zw-vrow__status {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 10px;
	font-family: var(--zw-mono);
	color: var(--zw-accent);
	white-space: nowrap;
}

/* ── meta ── */
.zw-vrow__desc {
	font-size: 11px;
	color: var(--zw-muted);
	line-height: 1.45;
}

.zw-vrow__range {
	font-family: var(--zw-mono);
	font-size: 9px;
	color: var(--zw-muted);
}
</style>
