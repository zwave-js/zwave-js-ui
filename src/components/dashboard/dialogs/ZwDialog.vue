<template>
	<v-dialog
		:model-value="modelValue"
		:width="widthPx"
		:persistent="blocking || persistent"
		content-class="zw-dlg__vcontent"
		class="zw-dlg__overlay"
		:class="{ 'zw-dlg__overlay--blocking': blocking }"
		scrim="black"
		@update:model-value="onModel"
		@after-leave="emit('afterLeave')"
	>
		<div class="zw-dlg" role="dialog" aria-modal="true" :aria-label="title">
			<ZwProgressBar
				v-if="loading"
				:value="null"
				class="zw-dlg__loading"
			/>
			<div v-if="hasRule" class="zw-dlg__rule" :class="ruleClass" />

			<!-- Vertical-rail wizard layout: rail spans header+body, footer stays full-width. -->
			<div v-if="$slots.rail" class="zw-dlg__split">
				<slot name="rail" />
				<div class="zw-dlg__main">
					<slot name="header" :close="close">
						<component :is="headerVNode" />
					</slot>
					<div class="zw-dlg__body">
						<slot />
					</div>
				</div>
			</div>

			<template v-else>
				<slot name="header" :close="close">
					<component :is="headerVNode" />
				</slot>
				<div class="zw-dlg__body">
					<slot />
				</div>
			</template>

			<div
				v-if="$slots['footer-left'] || actions.length"
				class="zw-dlg__footer"
			>
				<div class="zw-dlg__footer-left">
					<slot name="footer-left" />
				</div>
				<ZwButton
					v-for="(a, i) in actions"
					:key="i"
					:variant="variantFor(a)"
					:disabled="a.disabled"
					:autofocus="a.autoFocus || undefined"
					@click="a.onClick"
				>
					<template v-if="a.icon" #icon>
						<component :is="a.icon" :size="ICON_SIZE.std" />
					</template>
					{{ a.label }}
				</ZwButton>
			</div>
		</div>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, h, type Component } from 'vue'
import ZwButton from '@/components/dashboard/atoms/ZwButton.vue'
import ZwProgressBar from '@/components/dashboard/atoms/ZwProgressBar.vue'
import ZwDialogClose from './ZwDialogClose.vue'
import { AlertIcon, CheckIcon, ICON_SIZE } from '@/lib/icons'
import type {
	DialogAction,
	DialogSeverity,
	DialogSize,
	ZwButtonVariant,
} from '@/lib/dashboard-types'

const props = withDefaults(
	defineProps<{
		modelValue: boolean
		size?: DialogSize
		severity?: DialogSeverity
		title?: string
		subtitle?: string
		icon?: Component | null
		blocking?: boolean
		// Suppress Esc and backdrop dismiss, keep the close button
		persistent?: boolean
		loading?: boolean
		actions?: DialogAction[]
	}>(),
	{
		size: 'md',
		severity: 'default',
		title: '',
		subtitle: '',
		icon: null,
		blocking: false,
		persistent: false,
		loading: false,
		actions: () => [],
	},
)

const emit = defineEmits<{
	'update:modelValue': [boolean]
	close: []
	afterLeave: []
}>()

const WIDTHS: Record<DialogSize, number> = {
	sm: 400,
	md: 540,
	lg: 720,
	xl: 920,
}
const widthPx = computed(() => WIDTHS[props.size])

const RULE = { success: true, warning: true, danger: true } as Record<
	DialogSeverity,
	boolean
>
const hasRule = computed(() => !!RULE[props.severity])
const ruleClass = computed(() => `zw-dlg__rule--${props.severity}`)

const TONE: Record<DialogSeverity, string> = {
	default: 'zw-tone-accent',
	info: 'zw-tone-info',
	success: 'zw-tone-ok',
	warning: 'zw-tone-warn',
	danger: 'zw-tone-danger',
}

const DEFAULT_ICON: Partial<Record<DialogSeverity, Component>> = {
	success: CheckIcon,
	warning: AlertIcon,
	danger: AlertIcon,
}

const chipIcon = computed(
	() => props.icon ?? DEFAULT_ICON[props.severity] ?? null,
)
const showClose = computed(() => !props.blocking)

function onModel(v: boolean) {
	emit('update:modelValue', v)
	if (!v) emit('close')
}
function close() {
	onModel(false)
}

// VNode so the `header` slot can replace the whole region
const headerVNode = () =>
	h('div', { class: 'zw-dlg__header' }, [
		chipIcon.value &&
			h('div', { class: ['zw-dlg__chip', TONE[props.severity]] }, [
				h(chipIcon.value, { size: ICON_SIZE.topbar }),
			]),
		h('div', { class: 'zw-dlg__titles' }, [
			props.title && h('h2', { class: 'zw-dlg__title' }, props.title),
			props.subtitle &&
				h('div', { class: 'zw-dlg__subtitle' }, props.subtitle),
		]),
		showClose.value && h(ZwDialogClose, { onClick: close }),
	])

function variantFor(a: DialogAction): ZwButtonVariant {
	const kind = a.kind ?? 'text'
	const tone = a.tone ?? 'accent'
	if (kind === 'filled') return tone === 'danger' ? 'danger' : 'primary'
	if (kind === 'outline') return 'outline'
	if (tone === 'danger') return 'text-danger'
	if (tone === 'neutral') return 'ghost'
	return 'text'
}
</script>

<style>
/* Non-scoped: v-dialog teleports its content out of this component's DOM
   subtree, so scoped selectors would not reach it. Everything is
   namespaced under .zw-dlg to stay isolated. */

/* Content box: width = min(breakpoint, viewport − margin); the specific
   selector overrides Vuetify's default calc(100% − 48px) cap so the
   dialog fills the screen with only a small margin on phones. */
.v-overlay__content.zw-dlg__vcontent {
	max-width: calc(100vw - 32px);
	max-height: 90vh;
	margin: 16px;
}

@media (max-width: 600px) {
	.v-overlay__content.zw-dlg__vcontent {
		max-width: calc(100vw - 16px);
		margin: 8px;
	}
}

.zw-dlg__overlay .v-overlay__scrim {
	opacity: 0.48;
}

.zw-dlg__overlay--blocking .v-overlay__scrim {
	opacity: 0.62;
}

.zw-dlg {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	max-height: 86vh;
	background: var(--zw-card);
	color: var(--zw-fg);
	border-radius: var(--zw-radius-lg);
	box-shadow: var(--zw-e8);
	overflow: hidden;
	font-family: var(--zw-font);
}

.zw-dlg__loading {
	flex-shrink: 0;
}

.zw-dlg__rule {
	height: 3px;
	flex-shrink: 0;
}

.zw-dlg__rule--success {
	background: var(--zw-ok);
}

.zw-dlg__rule--warning {
	background: var(--zw-warning);
}

.zw-dlg__rule--danger {
	background: var(--zw-danger);
}

/* ── header ── */
.zw-dlg__header {
	display: flex;
	align-items: center;
	gap: 14px;
	padding: var(--zw-dlg-pad-top) var(--zw-dlg-pad-x) 14px;
	flex-shrink: 0;
}

.zw-dlg__chip {
	width: 36px;
	height: 36px;
	border-radius: var(--zw-radius-lg);
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: var(--tone-bg);
	color: var(--tone-fg);
}

.zw-dlg__titles {
	flex: 1;
	min-width: 0;
}

.zw-dlg__title {
	margin: 0;
	font: var(--zw-text-h-m);
	letter-spacing: -0.2px;
	line-height: 1.25;
	color: var(--zw-fg);
}

.zw-dlg__subtitle {
	margin-top: 3px;
	font: var(--zw-text-caption);
	color: var(--zw-muted);
}

/* ── body ── */
.zw-dlg__body {
	padding: 2px var(--zw-dlg-pad-x) 16px;
	overflow-y: auto;
	flex: 0 1 auto;
	font: var(--zw-text-body);
	font-weight: 400;
	line-height: 1.55;
	color: var(--zw-fg);
}

/* ── rail split ── */
.zw-dlg__split {
	display: flex;
	min-height: 0;
	flex: 1;
}

.zw-dlg__main {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
}

/* ── footer ── */
.zw-dlg__footer {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 12px var(--zw-dlg-pad-x);
	flex-shrink: 0;
	border-top: 1px solid var(--zw-line-soft);
}

.zw-dlg__footer-left {
	margin-right: auto;
}
</style>
