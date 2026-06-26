<template>
	<div v-if="device" class="zw-drawer__overlay" @click.self="emit('close')">
		<div
			ref="panelRef"
			class="zw-drawer__panel"
			role="dialog"
			aria-modal="true"
			:aria-label="device.name"
			@click.stop
		>
			<header class="zw-drawer__header">
				<div class="zw-drawer__icon">
					<component
						:is="device.archetype.icon"
						:size="ICON_SIZE.drawerHeader"
					/>
				</div>
				<div class="zw-drawer__name-col">
					<div class="zw-drawer__name">{{ device.name }}</div>
					<div class="zw-drawer__sub">
						Node {{ paddedNodeId }}
						<template v-if="device.manufacturer">
							· {{ device.manufacturer }}
						</template>
						<template v-if="device.productCode">
							· {{ device.productCode }}
						</template>
					</div>
				</div>
				<button
					ref="closeRef"
					type="button"
					class="zw-drawer__close"
					aria-label="Close drawer"
					@click="emit('close')"
				>
					<XIcon :size="ICON_SIZE.topbar" />
				</button>
			</header>
			<div class="zw-drawer__body">
				<ZwNodeDetailsBody
					:device="device"
					layout="stacked"
					@action="(d, a) => emit('action', d, a)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { createFocusTrap, type FocusTrap } from 'focus-trap'
import ZwNodeDetailsBody from '@/components/dashboard/components/ZwNodeDetailsBody.vue'
import { ICON_SIZE, XIcon } from '@/lib/icons'
import { MOBILE_BREAKPOINT } from '@/lib/dashboard-breakpoints'
import { padNumber } from '@/lib/utils'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device | null; viewport: number }>()
const emit = defineEmits<{
	close: []
	action: [Device, DeviceAction]
}>()

const panelRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLButtonElement | null>(null)
let trap: FocusTrap | null = null

const paddedNodeId = computed(() => padNumber(props.device?.nodeId ?? 0, 3))

const panelWidth = computed(() => {
	if (props.viewport < MOBILE_BREAKPOINT) return props.viewport
	return Math.max(460, Math.min(Math.round(props.viewport * 0.6), 1000))
})

function activateTrap() {
	if (!panelRef.value) return
	trap = createFocusTrap(panelRef.value, {
		escapeDeactivates: false,
		initialFocus: () => closeRef.value ?? panelRef.value!,
		allowOutsideClick: true,
	})
	trap.activate()
}

function deactivateTrap() {
	trap?.deactivate()
	trap = null
}

function onKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		e.stopPropagation()
		emit('close')
	}
}

// Trap focus only on the open transition and release it on close; switching
// from one device to another keeps the single active trap on the same panel.
watch(
	() => props.device,
	async (d, prev) => {
		if (d && !prev) {
			await nextTick()
			activateTrap()
			document.addEventListener('keydown', onKeyDown)
		} else if (!d && prev) {
			deactivateTrap()
			document.removeEventListener('keydown', onKeyDown)
		}
	},
	{ immediate: true },
)

onBeforeUnmount(() => {
	deactivateTrap()
	document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
/* `position: absolute` scopes the drawer to its parent body container, so
   the surrounding shell chrome stays visible and interactive while a
   device is open. */
.zw-drawer__overlay {
	position: absolute;
	inset: 0;
	z-index: 30;
	background: rgba(30, 25, 20, 0.32);
	display: flex;
	justify-content: flex-end;
	animation: zw-fade-in 0.18s;
}

.zw-drawer__panel {
	display: flex;
	flex-direction: column;
	width: v-bind('panelWidth + "px"');
	max-width: 100%;
	height: 100%;
	background: var(--zw-card);
	box-shadow: var(--zw-e-drawer);
	border: none;
	padding: 0;
	overflow: hidden;
	color: var(--zw-fg);
	animation: zw-slide-in-right 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
}

@media (max-width: 600px) {
	.zw-drawer__panel {
		width: 100% !important;
	}
}

.zw-drawer__header {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 18px;
	border-bottom: 1px solid var(--zw-line);
}

.zw-drawer__icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	border-radius: 12px;
	background: var(--zw-chip-bg);
	color: var(--zw-fg);
	flex: 0 0 44px;
}

.zw-drawer__name-col {
	flex: 1;
	min-width: 0;
}

.zw-drawer__name {
	font-size: 16px;
	font-weight: 600;
	color: var(--zw-fg);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-drawer__sub {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
	margin-top: 2px;
}

.zw-drawer__close {
	appearance: none;
	background: transparent;
	border: none;
	cursor: pointer;
	color: var(--zw-fg-soft);
	padding: 6px;
	border-radius: 999px;
	transition: background 0.12s;
}

.zw-drawer__close:hover {
	background: rgba(0, 0, 0, 0.04);
}

.zw-drawer__close:focus-visible {
	outline: 2px solid var(--zw-accent);
	outline-offset: 1px;
}

.zw-drawer__body {
	flex: 1;
	overflow-y: auto;
}

@media (prefers-reduced-motion: reduce) {
	.zw-drawer__overlay,
	.zw-drawer__panel {
		animation-duration: 0.01ms;
	}
}
</style>
