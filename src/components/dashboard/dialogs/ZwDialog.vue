<template>
	<Dialog.Root
		v-if="isMounted"
		:id="dialogId"
		:namespace="dialogId"
		v-model="rootOpen"
	>
		<Dialog.Content
			:namespace="dialogId"
			class="zw-dlg__native"
			:style="{ width: `${widthPx}px` }"
			:close-on-click-outside="dismiss === 'all'"
			:blocking="dismiss !== 'all'"
			:data-blocking="dismiss === 'none' || undefined"
			@keydown.capture="onKeydown"
		>
			<div ref="content" class="zw-dlg" :aria-label="title">
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
							<ZwDialogHeader
								v-bind="headerProps"
								@close="close"
							/>
						</slot>
						<div class="zw-dlg__body">
							<slot />
						</div>
					</div>
				</div>

				<template v-else>
					<slot name="header" :close="close">
						<ZwDialogHeader v-bind="headerProps" @close="close" />
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
		</Dialog.Content>
	</Dialog.Root>
</template>

<script setup lang="ts">
import {
	computed,
	onBeforeUnmount,
	ref,
	useId,
	watch,
	type Component,
} from 'vue'
import { Dialog, usePresence } from '@vuetify/v0'
import ZwButton from '@/components/dashboard/atoms/ZwButton.vue'
import ZwProgressBar from '@/components/dashboard/atoms/ZwProgressBar.vue'
import ZwDialogHeader from './ZwDialogHeader.vue'
import { AlertIcon, CheckIcon, InfoIcon, ICON_SIZE } from '@/lib/icons'
import type {
	DialogAction,
	DialogDismiss,
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
		// Which dismissal affordances the dialog offers
		dismiss?: DialogDismiss
		loading?: boolean
		actions?: DialogAction[]
	}>(),
	{
		size: 'md',
		severity: 'default',
		title: '',
		subtitle: '',
		icon: null,
		dismiss: 'all',
		loading: false,
		actions: () => [],
	},
)

const emit = defineEmits<{
	'update:modelValue': [boolean]
	afterLeave: []
	// Measured content width, for consumers that switch layout on it
	'update:contentWidth': [number]
}>()

// Doubles as the v0 injection namespace: contexts are registered per namespace
// rather than through the component hierarchy, so two dialogs sharing the
// default would resolve to one context and dismiss together.
const dialogId = `zw-dlg-${useId()}`

// Presence only defers unmount by a tick so `afterLeave` has a moment to fire
// after the element is gone; the native dialog closes immediately either way.
const { isMounted } = usePresence({
	present: () => props.modelValue,
	immediate: true,
})

// `modelValue` is the single source of truth. Routing v0's dismissal straight
// back out avoids a local mirror that v0 can re-raise, which would call
// `showModal()` a second time and re-promote the dialog in the top layer.
const rootOpen = computed({
	get: () => props.modelValue,
	set: (v) => {
		if (!v) close()
	},
})

watch(isMounted, (mounted) => {
	if (!mounted) emit('afterLeave')
})

// One Escape natively closes *every* open modal dialog, not just the topmost
// (Chrome 150), so cancel the default and dismiss only this one. `showModal`
// traps focus in the top dialog, so that is where the keydown lands.
function onKeydown(e: KeyboardEvent) {
	if (e.key !== 'Escape') return
	e.preventDefault()
	if (props.dismiss === 'all') close()
}

// Reported rather than derived from the window: dashboard breakpoints are
// container widths, and the dialog is narrower than the viewport
const content = ref<HTMLElement | null>(null)
let ro: ResizeObserver | null = null

watch(content, (el) => {
	ro?.disconnect()
	ro = null
	if (!el) return
	emit('update:contentWidth', el.clientWidth)
	ro = new ResizeObserver(() => emit('update:contentWidth', el.clientWidth))
	ro.observe(el)
})

onBeforeUnmount(() => {
	ro?.disconnect()
})

const WIDTHS: Record<DialogSize, number> = {
	sm: 400,
	md: 540,
	lg: 720,
	xl: 920,
}
const widthPx = computed(() => WIDTHS[props.size])

const RULE = {
	info: true,
	success: true,
	warning: true,
	danger: true,
} as Record<DialogSeverity, boolean>
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
	info: InfoIcon,
	success: CheckIcon,
	warning: AlertIcon,
	danger: AlertIcon,
}

const chipIcon = computed(
	() => props.icon ?? DEFAULT_ICON[props.severity] ?? null,
)
const showClose = computed(() => props.dismiss !== 'none')

function close() {
	emit('update:modelValue', false)
}

const headerProps = computed(() => ({
	title: props.title,
	subtitle: props.subtitle,
	icon: chipIcon.value,
	tone: TONE[props.severity],
	showClose: showClose.value,
}))

function variantFor(a: DialogAction): ZwButtonVariant {
	const kind = a.kind ?? 'text'
	const tone = a.tone ?? 'accent'
	if (kind === 'filled') {
		if (tone === 'danger') return 'danger'
		return tone === 'neutral' ? 'outline' : 'primary'
	}
	if (kind === 'outline') return 'outline'
	if (tone === 'danger') return 'text-danger'
	if (tone === 'neutral') return 'ghost'
	return 'text'
}
</script>

<style>
/* Non-scoped: the native dialog lives in the top layer outside this
   component's DOM subtree, so scoped selectors would not reach it. */

/* The <dialog> element is the positioning box, .zw-dlg inside is the panel */
/* Width arrives inline from the size prop */
.zw-dlg__native {
	max-width: calc(100vw - 32px);
	max-height: var(--zw-dlg-max-h);
	margin: auto;
	padding: 0;
	border: none;
	background: transparent;
	overflow: visible;
	animation: zw-dlg-enter 0.16s ease-out;
}

.zw-dlg__native::backdrop {
	background: rgba(0, 0, 0, 0.48);
	animation: zw-fade-in 0.16s;
}

/* Darker where the dialog offers no dismissal affordance, so the block reads
   as deliberate rather than as an unresponsive page */
.zw-dlg__native[data-blocking]::backdrop {
	background: rgba(0, 0, 0, 0.62);
}

@media (max-width: 600px) {
	.zw-dlg__native {
		max-width: calc(100vw - 16px);
	}
}

@keyframes zw-dlg-enter {
	from {
		opacity: 0;
		transform: scale(0.96);
	}
}

@media (prefers-reduced-motion: reduce) {
	.zw-dlg__native {
		animation-duration: 0.01ms;
	}
}

.zw-dlg {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	max-height: var(--zw-dlg-max-h);
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

.zw-dlg__rule--info {
	background: var(--zw-accent);
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
	padding: var(--zw-dlg-pad-top) var(--zw-dlg-pad-x) 6px;
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
	/* Scrolling clips both axes, and a Vuetify floating label sits ~8px above
	   its field, so the first row of a form needs that much headroom */
	padding: 10px var(--zw-dlg-pad-x) 16px;
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
