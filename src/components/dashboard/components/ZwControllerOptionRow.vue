<template>
	<div class="zw-optrow" :class="{ 'zw-optrow--dirty': dirty }">
		<!-- label line -->
		<div class="zw-optrow__head">
			<span class="zw-optrow__label">{{ option.label }}</span>

			<Popover.Root v-model="menuOpen" :id="menuId">
				<Popover.Activator
					as="button"
					class="zw-optrow__menu-btn zw-focus-ring"
					title="More"
				>
					<MoreIcon :size="ICON_SIZE.inline" />
				</Popover.Activator>
				<Popover.Content as="div" class="zw-optrow__menu" role="menu">
					<button
						type="button"
						class="zw-optrow__menu-item"
						@click="refresh"
					>
						<RefreshIcon :size="ICON_SIZE.dense" /> Refresh value
					</button>
				</Popover.Content>
			</Popover.Root>
		</div>

		<!-- control line -->
		<div
			class="zw-optrow__control"
			:class="{ 'zw-optrow__control--busy': busy }"
		>
			<!-- read-only display -->
			<template v-if="option.kind === 'readonly'">
				<span class="zw-optrow__display">{{ option.display }}</span>
			</template>

			<!-- enum select -->
			<template v-else-if="option.kind === 'enum'">
				<ZwDropdown
					:model-value="asOptionValue(cur)"
					:options="option.options ?? []"
					:disabled="busy"
					@update:model-value="commit"
				/>
			</template>

			<!-- number -->
			<template v-else-if="option.kind === 'number'">
				<ZwNumericInput
					:model-value="String(cur ?? '')"
					:min="option.min"
					:max="option.max"
					:step="option.step"
					:unit="option.unit"
					:disabled="busy"
					:dirty="dirty"
					@update:model-value="draft = $event"
					@commit="send"
					@reset="draft = null"
				/>
			</template>

			<span v-if="busy" class="zw-optrow__status">
				<RefreshIcon :size="ICON_SIZE.chip" class="zw-spin" />
				{{ sending ? 'Setting…' : 'Refreshing…' }}
			</span>
		</div>

		<!-- description -->
		<div v-if="option.description" class="zw-optrow__desc">
			{{ option.description }}
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Popover } from '@vuetify/v0'
import ZwDropdown from '@/components/dashboard/atoms/ZwDropdown.vue'
import ZwNumericInput from '@/components/dashboard/atoms/ZwNumericInput.vue'
import { ICON_SIZE, MoreIcon, RefreshIcon } from '@/lib/icons'
import { usePopoverFallback } from '@/lib/popover-fallback.ts'
import type { ControllerOption } from '@/lib/controllerOptions.ts'

const props = withDefaults(
	defineProps<{
		option: ControllerOption
		sending?: boolean
		refreshing?: boolean
	}>(),
	{ sending: false, refreshing: false },
)
const emit = defineEmits<{
	change: [key: string, value: unknown]
	refresh: [key: string]
}>()

const draft = ref<unknown>(null)
const menuOpen = ref(false)
const menuId = `zw-optrow-${useId()}`

usePopoverFallback({ open: menuOpen, contentId: menuId })

const cur = computed(() =>
	draft.value !== null ? draft.value : props.option.value,
)
const dirty = computed(
	() =>
		draft.value !== null &&
		String(draft.value) !== String(props.option.value),
)
const busy = computed(() => props.sending || props.refreshing)

watch(
	() => props.option.value,
	() => {
		draft.value = null
	},
)

function commit(value: unknown) {
	menuOpen.value = false
	draft.value = null
	emit('change', props.option.key, value)
}

function send() {
	if (!dirty.value) return
	const v = props.option.kind === 'number' ? Number(draft.value) : draft.value
	commit(v)
}

function refresh() {
	menuOpen.value = false
	emit('refresh', props.option.key)
}

function asOptionValue(v: unknown): number | string | boolean | null {
	if (
		typeof v === 'number' ||
		typeof v === 'string' ||
		typeof v === 'boolean'
	)
		return v
	return null
}
</script>

<style>
.zw-optrow {
	padding: 10px 12px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	flex: 1;
	min-width: 0;
	background: transparent;
	transition: background 0.15s;
}

.zw-optrow--dirty {
	background: rgba(var(--v0-primary), 0.05);
}

/* ── label line ── */
.zw-optrow__head {
	display: flex;
	align-items: flex-start;
	gap: 8px;
}

.zw-optrow__label {
	font-size: 12px;
	font-weight: 500;
	color: var(--zw-fg);
	min-width: 0;
	flex: 1;
	line-height: 17px;
	overflow-wrap: anywhere;
}

.zw-optrow__menu-btn {
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

.zw-optrow__menu-btn[data-open] {
	background: var(--zw-chip-bg);
}

.zw-optrow__menu {
	position-area: none !important;
	position-anchor: auto !important;
	min-width: 180px;
	background: var(--zw-card);
	border: 1px solid var(--zw-line2);
	border-radius: 6px;
	box-shadow: var(--zw-e8);
	padding: 0;
	overflow: hidden;
	animation: zw-fade-in 0.12s;
}

.zw-optrow__menu::backdrop {
	display: none;
}

.zw-optrow__menu-item {
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
}

.zw-optrow__menu-item:hover {
	background: var(--zw-row-hover);
}

/* ── control line ── */
.zw-optrow__control {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	transition: opacity 0.15s;
}

.zw-optrow__control--busy {
	opacity: 0.55;
}

.zw-optrow__display {
	font-family: var(--zw-mono);
	font-size: 14px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	overflow-wrap: anywhere;
}

.zw-optrow__status {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 10px;
	font-family: var(--zw-mono);
	color: var(--zw-accent);
	white-space: nowrap;
}

/* ── meta ── */
.zw-optrow__desc {
	font-size: 11px;
	color: var(--zw-muted);
	line-height: 1.45;
}
</style>
